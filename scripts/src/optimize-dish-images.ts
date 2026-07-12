import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

// ES modules __dirname replacement
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Must match the catalog's `image` field prefix (@workspace/menu-catalog uses
// "/images/dishes/<slug>.jpg") and the prefix imgSrcset.ts's localDishSrcset /
// getLocalDishFallback match against — otherwise every generated variant is
// unreachable dead weight and the responsive <picture>/srcSet never engages.
const DISHES_DIR = path.resolve(__dirname, "../../artifacts/tanmatra/public/images/dishes");

async function main() {
  console.log(`Scanning dishes directory: ${DISHES_DIR}`);
  if (!fs.existsSync(DISHES_DIR)) {
    console.error(`Dishes directory not found!`);
    process.exit(1);
  }

  const files = fs.readdirSync(DISHES_DIR);
  const sourceImages = files.filter(f => {
    const ext = path.extname(f).toLowerCase();
    const isImage = ext === ".jpg" || ext === ".jpeg" || ext === ".png";
    const isDerivative = /-\d+\.(webp|avif|jpg|jpeg|png)$/.test(f);
    return isImage && !isDerivative;
  });

  console.log(`Found ${sourceImages.length} source images to optimize.`);

  const widths = [200, 400, 800];

  for (const imgFile of sourceImages) {
    const srcPath = path.join(DISHES_DIR, imgFile);
    const ext = path.extname(imgFile);
    const baseName = path.basename(imgFile, ext);

    console.log(`Processing ${imgFile}...`);

    for (const w of widths) {
      // 1. Export WebP
      const webpPath = path.join(DISHES_DIR, `${baseName}-${w}.webp`);
      if (!fs.existsSync(webpPath)) {
        try {
          await sharp(srcPath)
            .resize(w)
            .webp({ quality: 80 })
            .toFile(webpPath);
          console.log(`  -> Generated ${baseName}-${w}.webp`);
        } catch (e: any) {
          console.error(`  x Failed to generate WebP for ${baseName}-${w}: ${e.message}`);
        }
      }

      // 2. Export AVIF
      const avifPath = path.join(DISHES_DIR, `${baseName}-${w}.avif`);
      if (!fs.existsSync(avifPath)) {
        try {
          await sharp(srcPath)
            .resize(w)
            .avif({ quality: 65 })
            .toFile(avifPath);
          console.log(`  -> Generated ${baseName}-${w}.avif`);
        } catch (e: any) {
          console.error(`  x Failed to generate AVIF for ${baseName}-${w}: ${e.message}`);
        }
      }

      // 3. Export fallback JPEG/PNG (smaller size)
      const fallbackExt = ext.toLowerCase() === ".png" ? "png" : "jpeg";
      const fallbackPath = path.join(DISHES_DIR, `${baseName}-${w}${ext}`);
      if (!fs.existsSync(fallbackPath)) {
        try {
          const pipeline = sharp(srcPath).resize(w);
          if (fallbackExt === "png") {
            await pipeline.png({ compressionLevel: 8 }).toFile(fallbackPath);
          } else {
            await pipeline.jpeg({ quality: 80, progressive: true }).toFile(fallbackPath);
          }
          console.log(`  -> Generated ${baseName}-${w}${ext}`);
        } catch (e: any) {
          console.error(`  x Failed to generate fallback for ${baseName}-${w}: ${e.message}`);
        }
      }
    }
  }

  console.log("Optimization complete!");
}

main().catch(err => {
  console.error("Error optimizing images:", err);
  process.exit(1);
});
