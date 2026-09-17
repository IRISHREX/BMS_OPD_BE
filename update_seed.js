import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seedFile = path.join(__dirname, 'seed.js');
let seedContent = fs.readFileSync(seedFile, 'utf8');

if (!seedContent.includes('orthoData.js')) {
    // Inject import
    seedContent = seedContent.replace(
        'import { MedicalAdvice } from "./models/medicalAdviceSchema.js";',
        'import { MedicalAdvice } from "./models/medicalAdviceSchema.js";\nimport { orthoMedicines, orthoAdvices } from "./orthoData.js";'
    );
    
    // Inject into medicines array
    // We can just append `...orthoMedicines` at the end of the array
    // The array ends with `];`
    
    // Instead of complex regex, let's just append to the arrays before they are used.
    // In seedDatabase function:
    // We can add orthoMedicines to medicines, and orthoAdvices to medicalAdvices.
    
    seedContent = seedContent.replace(
        'async function seedDatabase() {',
        'medicines.push(...orthoMedicines);\nmedicalAdvices.push(...orthoAdvices);\n\nasync function seedDatabase() {'
    );
    
    fs.writeFileSync(seedFile, seedContent, 'utf8');
    console.log('Successfully updated seed.js to include ortho data.');
} else {
    console.log('seed.js already updated.');
}
