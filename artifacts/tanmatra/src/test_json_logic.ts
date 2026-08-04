import { DeterministicJsonEvaluator } from './ContraindicationEngine';

const patient = {
  allergies: [{ allergen: 'PEANUT', severity: 'HIGH' }]
};

const dish = {
  allergens: ['PEANUT'],
  shared_facility_allergens: [],
  processing: { elisa_zero_ppm_certified: false }
};

const spec = {
  some: [
    {var: 'patient.allergies'},
    {
      and: [
        {in: [{var: 'severity'}, ['HIGH', 'ANAPHYLACTIC']]},
        {
          or: [
            {in: [{var: 'allergen'}, {var: 'dish.allergens'}]},
          ],
        },
      ],
    },
  ],
};

const result = DeterministicJsonEvaluator.evaluate(spec, { patient, dish });
console.log('Result:', result);
