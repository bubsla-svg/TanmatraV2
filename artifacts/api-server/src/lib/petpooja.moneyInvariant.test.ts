/**
 * What `total_paise` means on an inbound aggregator order, and why the mapper
 * writing a GRAND total into it is right rather than wrong.
 *
 * This file exists because the obvious reading of `mapPetpoojaOrderToDb` is
 * that it repeats the outbound charge-fidelity bug in reverse. The column says
 * "meal subtotal after discounts/credit (NO GST, NO delivery fee)"; the mapper
 * writes Petpooja's `Order.details.total`, which is the customer's grand total
 * with GST, delivery and packing in it. That reading was written down as a
 * planned fix (claude/order-channel-split.md §6 row 8). It is wrong, and
 * shipping it would have moved money.
 *
 * The invariant the money path actually depends on is not "total_paise is a
 * subtotal". It is:
 *
 *     chargePaise ?? totalPaise  ==  the payable gross
 *
 * stated in paymentIntegrity.ts's own doc comment and instantiated by the
 * guest-checkout path, which writes a GST-and-fee-inclusive number into
 * `totalPaise` and leaves `chargePaise` null. `charge_paise` is the authority
 * only for orders we priced ourselves.
 *
 * Seven call sites resolve money through that expression, and the sharp one is
 * routes/orders.ts's cancel path, which seeds `refund_requests.amount_paise`
 * from it with no channel predicate. Narrow `total_paise` to a recomputed meal
 * subtotal for POS rows and an operator gets shown less than the customer paid.
 *
 * So these tests pin the relationship, not a literal: the mapper must write the
 * gross, must leave `chargePaise` unset, and the two together must resolve to
 * the gross.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { mapPetpoojaOrderToDb } from "./petpooja";
import { resolvePayableAmountPaise } from "./paymentIntegrity";
import { usersTable, menuItemsTable, isMealOrderItem } from "@workspace/db/schema";

// A payload whose components DO reconcile, unlike Petpooja's documentation
// sample (see the last test). Item ₹110.00 × 2 = ₹220.00 of food:
//
//   220.00 items + 50.00 delivery + 20.00 packing + 65.52 tax − 45.00 discount
//   = 310.52  ← Order.details.total
//
// Every number below is therefore checkable against every other one, which is
// what lets these tests assert relationships instead of magic constants.
const ITEM_UNIT_RUPEES = 110;
const ITEM_QTY = 2;
const DELIVERY_RUPEES = 50;
const PACKING_RUPEES = 20;
const TAX_RUPEES = 65.52;
const DISCOUNT_RUPEES = 45;
const FOOD_RUPEES = ITEM_UNIT_RUPEES * ITEM_QTY;
const GRAND_RUPEES = FOOD_RUPEES + DELIVERY_RUPEES + PACKING_RUPEES + TAX_RUPEES - DISCOUNT_RUPEES;

function balancedPayload() {
  return {
    app_key: "key",
    app_secret: "secret",
    access_token: "token",
    orderinfo: {
      OrderInfo: {
        Restaurant: {
          details: { res_name: "Tanmatra", address: "", contact_information: "", restID: "rest12" },
        },
        Customer: {
          details: { email: "user@example.com", name: "John", address: "Amin Society", phone: "9090909090" },
        },
        Order: {
          details: {
            orderID: "Z-9001",
            preorder_date: "2026-07-20",
            preorder_time: "12:30:00",
            delivery_charges: DELIVERY_RUPEES.toFixed(2),
            packing_charges: PACKING_RUPEES.toFixed(2),
            order_type: "H",
            payment_type: "ONLINE",
            total: GRAND_RUPEES.toFixed(2),
            tax_total: TAX_RUPEES.toFixed(2),
            discount_total: DISCOUNT_RUPEES.toFixed(2),
            created_on: "2026-07-20 12:29:00",
            order_from: "Zomato",
          },
        },
        OrderItem: {
          details: [
            {
              id: "118829149",
              name: "Veg Loaded Pizza",
              price: ITEM_UNIT_RUPEES.toFixed(2),
              final_price: (ITEM_UNIT_RUPEES * ITEM_QTY).toFixed(2),
              quantity: String(ITEM_QTY),
            },
          ],
        },
      },
    },
  };
}

const stubDb = {
  select: () => ({
    from: (table: unknown) => ({
      where: () => ({
        limit: () => {
          if (table === usersTable) return Promise.resolve([{ id: "usr_abc123" }]);
          if (table === menuItemsTable) return Promise.resolve([{ id: 401, name: "Veg Loaded Pizza" }]);
          return Promise.resolve([]);
        },
      }),
    }),
  }),
};

test("total_paise carries the aggregator's grand total, not a recomputed subtotal", async () => {
  const order = await mapPetpoojaOrderToDb(balancedPayload() as never, stubDb);

  // Stated as the relationship, so the assertion survives a fixture edit.
  assert.equal(order.totalPaise, Math.round(GRAND_RUPEES * 100));

  // And is demonstrably NOT any of the subtotals a "fix" would have produced.
  // Naming them individually matters: each is a plausible-looking candidate,
  // and the point is that the mapper picks none of them.
  const foodPaise = Math.round(FOOD_RUPEES * 100);
  const foodLessDiscountPaise = Math.round((FOOD_RUPEES - DISCOUNT_RUPEES) * 100);
  assert.notEqual(order.totalPaise, foodPaise);
  assert.notEqual(order.totalPaise, foodLessDiscountPaise);
  assert.ok(
    order.totalPaise > foodPaise,
    "the grand total must exceed the food subtotal, or this fixture proves nothing",
  );
});

test("charge_paise is left unset on an inbound order, deliberately", async () => {
  const order = await mapPetpoojaOrderToDb(balancedPayload() as never, stubDb);

  // We never charge an aggregator order — the customer paid Zomato. Writing a
  // `charge_paise` here would assert we have a payable of our own against it,
  // and the payment path would believe us.
  assert.equal(order.chargePaise, undefined);
});

test("chargePaise ?? totalPaise resolves to the gross for an inbound order", async () => {
  const order = await mapPetpoojaOrderToDb(balancedPayload() as never, stubDb);

  // The whole invariant in one line. This is the expression behind
  // /payments/razorpay/order, both capture webhooks, the payment-link path,
  // and — the one that decides real money leaving the business — the refund
  // request seeded by routes/orders.ts's cancel handler.
  const payable = resolvePayableAmountPaise({
    chargePaise: order.chargePaise ?? null,
    totalPaise: order.totalPaise,
  });
  assert.equal(payable, Math.round(GRAND_RUPEES * 100));
});

test("the payload's components are not required to reconcile to its total", async () => {
  // Petpooja's own documentation sample — the fixture the older mapper test
  // uses — does not balance, and that is the decisive argument against
  // recomputing a subtotal from components.
  //
  //   items 110.00 × 2       = 220.00   (final_price is even stated as 110.00)
  //   + delivery 50 + packing 20 + tax 65.52 − discount 45
  //                          = 310.52
  //   Order.details.total    = 560.00
  //
  // Σ(components) would be a number we invented. `total` is the only figure the
  // aggregator actually asserts about the order, so it is the only one we can
  // carry without making something up.
  const docsSample = balancedPayload();
  docsSample.orderinfo.OrderInfo.Order.details.total = "560.00";
  docsSample.orderinfo.OrderInfo.OrderItem.details[0]!.final_price = "110.00";

  const order = await mapPetpoojaOrderToDb(docsSample as never, stubDb);

  const componentSum =
    FOOD_RUPEES + DELIVERY_RUPEES + PACKING_RUPEES + TAX_RUPEES - DISCOUNT_RUPEES;
  assert.notEqual(
    Math.round(componentSum * 100),
    order.totalPaise,
    "if the vendor's own sample ever starts balancing, revisit the reasoning above",
  );
  assert.equal(order.totalPaise, 56_000);
});

test("items still carry the per-line unit price, which is what makes the gross auditable", async () => {
  const order = await mapPetpoojaOrderToDb(balancedPayload() as never, stubDb);

  // `total_paise` being gross is only defensible because the composition is not
  // lost: `items` keeps the food side line by line, so an ops reader can always
  // subtract. That is why this assertion belongs in the money file rather than
  // only in the mapper's general test.
  const [line] = order.items;
  assert.ok(line && isMealOrderItem(line), "expected a meal line");
  assert.equal(line.price, Math.round(ITEM_UNIT_RUPEES * 100));
  assert.equal(line.qty, ITEM_QTY);
  assert.equal(line.price * line.qty, Math.round(FOOD_RUPEES * 100));
});
