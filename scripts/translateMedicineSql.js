import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlFilePath = path.resolve(__dirname, '../../medicine.sql');
const outputJsonPath = path.resolve(__dirname, '../medicines.json');

const commonBrandMap = [
  { regex: /\bPAN\s*D\b/i, comp: ["PANTOPRAZOLE", "DOMPERIDONE"] },
  { regex: /\bPAN\s*L\b/i, comp: ["PANTOPRAZOLE", "LEVOSULPIRIDE"] },
  { regex: /\bPAN\s*IT\b/i, comp: ["PANTOPRAZOLE", "ITOPRIDE"] },
  { regex: /\bPAN\s*MPS\b/i, comp: ["ALUMINIUM HYDROXIDE", "MAGNESIUM HYDROXIDE", "SIMETHICONE"] },
  { regex: /\bPANTOCID\s*DSR\b|\bPANTODAC\s*DSR\b/i, comp: ["PANTOPRAZOLE", "DOMPERIDONE"] },
  { regex: /\bPAN\b/i, comp: ["PANTOPRAZOLE"] },
  { regex: /\bPANTOCID\b/i, comp: ["PANTOPRAZOLE"] },
  { regex: /\bPANTOP\b/i, comp: ["PANTOPRAZOLE"] },
  { regex: /\bRABEKIND\s*DSR\b|\bRABEMAC\s*DSR\b|\bRABLET\s*D\b|\bRABICIP\s*D\b/i, comp: ["RABEPRAZOLE", "DOMPERIDONE"] },
  { regex: /\bRABEKIND\b|\bRABEMAC\b|\bRABLET\b|\bRABICIP\b/i, comp: ["RABEPRAZOLE"] },
  { regex: /\bOMEE\s*D\b|\bOMEZ\s*D\b/i, comp: ["OMEPRAZOLE", "DOMPERIDONE"] },
  { regex: /\bOMEE\b|\bOMEZ\b/i, comp: ["OMEPRAZOLE"] },
  { regex: /\bZERODOL\s*SP\b/i, comp: ["ACECLOFENAC", "PARACETAMOL", "SERRATIOPEPTIDASE"] },
  { regex: /\bZERODOL\s*TH\b/i, comp: ["ACECLOFENAC", "THIOCOLCHICOSIDE"] },
  { regex: /\bZERODOL\s*P\b/i, comp: ["ACECLOFENAC", "PARACETAMOL"] },
  { regex: /\bZERODOL\b/i, comp: ["ACECLOFENAC"] },
  { regex: /\bVOVERAN\b/i, comp: ["DICLOFENAC"] },
  { regex: /\bCOMBIFLAM\b/i, comp: ["IBUPROFEN", "PARACETAMOL"] },
  { regex: /\bBRUFEN\b/i, comp: ["IBUPROFEN"] },
  { regex: /\bDOLO\b|\bCALPOL\b|\bPARACIP\b|\bPACIMOL\b/i, comp: ["PARACETAMOL"] },
  { regex: /\bMEFTAL\s*SPAS\b/i, comp: ["MEFENAMIC ACID", "DICYCLOMINE"] },
  { regex: /\bMEFTAL\b/i, comp: ["MEFENAMIC ACID"] },
  { regex: /\bAUGMENTIN\b|\bCLAVAM\b|\bMOXIKIND\s*CV\b/i, comp: ["AMOXICILLIN", "POTASSIUM CLAVULANATE"] },
  { regex: /\bMOXIKIND\b|\bNOVAMOX\b/i, comp: ["AMOXICILLIN"] },
  { regex: /\bAZITHRAL\b|\bAZITHRO\b/i, comp: ["AZITHROMYCIN"] },
  { regex: /\bTAXIM\s*O\b|\bMAHACEF\b|\bZIPOD\b/i, comp: ["CEFIXIME"] },
  { regex: /\bMONTEK\s*LC\b|\bMONTICOPE\b|\bTELEKAST\s*L\b/i, comp: ["MONTELUKAST", "LEVOCETIRIZINE"] },
  { regex: /\bALERID\b|\bCETZINE\b/i, comp: ["CETIRIZINE"] },
  { regex: /\bLEVO\s*CET\b|\bVOZET\b/i, comp: ["LEVOCETIRIZINE"] },
  { regex: /\bGLYCOMET\s*GP\b/i, comp: ["METFORMIN", "GLIMEPIRIDE"] },
  { regex: /\bGLYCOMET\b/i, comp: ["METFORMIN"] },
  { regex: /\bTELMA\s*AM\b|\bTELMIKIND\s*AM\b/i, comp: ["TELMISARTAN", "AMLODIPINE"] },
  { regex: /\bTELMA\s*H\b|\bTELMIKIND\s*H\b/i, comp: ["TELMISARTAN", "HYDROCHLOROTHIAZIDE"] },
  { regex: /\bTELMA\b|\bTELMIKIND\b/i, comp: ["TELMISARTAN"] },
  { regex: /\bSHELCAL\b/i, comp: ["CALCIUM CARBONATE", "VITAMIN D3"] },
  { regex: /\bTHYRONORM\b|\bELTROXIN\b/i, comp: ["THYROXINE SODIUM"] },
  { regex: /\bBETADINE\b/i, comp: ["POVIDONE IODINE"] },
  { regex: /\bVOLINI\b/i, comp: ["DICLOFENAC DIETHYLAMINE"] }
];

function parseSqlValues(line) {
  const trimmed = line.trim().replace(/^,?\s*\(/, '').replace(/\)[,;]?$/, '');
  const tokens = [];
  let current = '';
  let inString = false;
  let escape = false;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (escape) {
      current += char;
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === "'") {
      inString = !inString;
      continue;
    }
    if (char === ',' && !inString) {
      tokens.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  tokens.push(current.trim());
  return tokens.map(t => (t === 'NULL' ? null : t));
}

function cleanComposition(rawComp, medicineName) {
  let comp = rawComp ? rawComp.trim().replace(/^['"]|['"]$/g, '').trim() : '';

  if (comp) {
    // Replace ' AND ' with comma
    comp = comp.replace(/\s+AND\s+/gi, ',');
    // Protect decimals like 0.5mg or 37.5mg before replacing dots
    comp = comp.replace(/(\d)\.(\d)/g, '$1__DOT__$2');
    // Replace delimiters +, ,, &, /, ;, \ and non-decimal dots with comma
    comp = comp.replace(/[\+,\&\/;\\]|\.(?!\d)/g, ',');
    // Restore decimals
    comp = comp.replace(/__DOT__/g, '.');

    const parts = comp.split(',').map(p => p.trim()).filter(Boolean);
    const cleaned = parts.map(p => p.replace(/\s+/g, ' ').trim()).filter(p => p.length > 0);
    if (cleaned.length > 0) return cleaned;
  }

  // If composition was empty in SQL, check commonBrandMap
  if (medicineName) {
    for (const item of commonBrandMap) {
      if (item.regex.test(medicineName)) {
        return [...item.comp];
      }
    }
  }

  return [];
}

function inferMedicineDetails(name, categoryName, unit, composition, company, rawNote) {
  const upperName = (name || '').toUpperCase();
  const upperCat = (categoryName || '').toUpperCase();
  const upperUnit = (unit || '').toUpperCase();

  // 1. FORMULATION / TYPE
  let type = 'Tablet';
  if (upperUnit && !['51', 'PCS', 'BOTTLE', 'BOX', 'STRIP', 'PACK', 'UNIT'].includes(upperUnit)) {
    type = unit;
  } else if (/\b(TAB|TABLET|TABLETS|DT|MD|DISPERSIBLE)\b/i.test(upperName)) {
    type = 'Tablet';
  } else if (/\b(CAP|CAPS|CAPSULE|CAPSULES)\b/i.test(upperName)) {
    type = 'Capsule';
  } else if (/\b(INJ|INJECTION|IV|INFUSION|VIAL|AMP|AMPOULE)\b/i.test(upperName) || upperCat.includes('INJECTION') || upperCat.includes('IV FLUID')) {
    type = 'Injection';
  } else if (/\b(SYP|SYRUP|SUSP|SUSPENSION|ELIXIR)\b/i.test(upperName)) {
    type = 'Syrup';
  } else if (/\b(DROP|DROPS)\b/i.test(upperName) || upperCat.includes('OPHTHALMIC') || /\bOTIC\b/.test(upperCat) || /\bNASAL\b/.test(upperCat)) {
    type = 'Drops';
  } else if (/\b(GEL)\b/i.test(upperName)) {
    type = 'Gel';
  } else if (/\b(OINT|OINTMENT)\b/i.test(upperName)) {
    type = 'Ointment';
  } else if (/\b(CREAM)\b/i.test(upperName)) {
    type = 'Cream';
  } else if (/\b(LOTION)\b/i.test(upperName)) {
    type = 'Lotion';
  } else if (/\b(SPRAY)\b/i.test(upperName)) {
    type = 'Spray';
  } else if (/\b(INHALER|INHALATION|MDI)\b/i.test(upperName) || upperCat.includes('ASTHMA')) {
    type = 'Inhaler';
  } else if (/\b(RESP|RESPULE|RESPULES)\b/i.test(upperName)) {
    type = 'Respule';
  } else if (/\b(SACHET|SACHETS)\b/i.test(upperName)) {
    type = 'Sachet';
  } else if (/\b(POWDER)\b/i.test(upperName)) {
    type = 'Powder';
  } else if (/\b(PESSARY|PESSARISE)\b/i.test(upperName)) {
    type = 'Pessary';
  } else if (/\b(SUPP|SUPPOSITORY)\b/i.test(upperName)) {
    type = 'Suppository';
  } else if (/\b(PATCH)\b/i.test(upperName)) {
    type = 'Patch';
  } else if (/\b(GARGLE|MOUTHWASH)\b/i.test(upperName)) {
    type = 'Mouthwash';
  } else if (upperCat.includes('CREAM') || upperCat.includes('OINTMENT') || upperCat.includes('TOPICAL')) {
    type = 'Ointment';
  }

  // 2. ROUTE OF ADMINISTRATION
  let route = 'Oral';
  if (type === 'Injection') {
    if (upperName.includes('IV') || upperCat.includes('IV FLUID')) route = 'IV';
    else if (upperName.includes('IM')) route = 'IM';
    else if (upperName.includes('SC')) route = 'SC';
    else route = 'IM/IV';
  } else if (['Ointment', 'Cream', 'Gel', 'Lotion', 'Patch'].includes(type)) {
    route = 'Topical';
  } else if (type === 'Drops') {
    if (upperName.includes('EYE') || upperCat.includes('OPHTHALMIC')) route = 'Ophthalmic';
    else if (upperName.includes('EAR') || /\bOTIC\b/.test(upperCat)) route = 'Otic';
    else if (upperName.includes('NASAL') || /\bNASAL\b/.test(upperCat)) route = 'Nasal';
    else route = 'Oral'; // Pediatric drops
  } else if (['Inhaler', 'Respule'].includes(type)) {
    route = 'Inhalation';
  } else if (type === 'Suppository') {
    route = 'Rectal';
  } else if (type === 'Pessary') {
    route = 'Vaginal';
  } else if (type === 'Mouthwash') {
    route = 'Oral (Gargle)';
  } else {
    route = 'Oral';
  }

  // 3. DOSE
  let dose = '';
  const isLiquidOrPack = ['Syrup', 'Suspension', 'Drops', 'Lotion', 'Solution', 'Gel', 'Ointment', 'Cream'].includes(type);
  const doseMatch = upperName.match(/(\d+(?:\.\d+)?\s*(?:MG\/ML|MG|MCG|IU|GM|G|%))/i);
  if (doseMatch) {
    dose = doseMatch[1].replace(/\s+/g, '').toLowerCase();
    if (dose.includes('iu')) dose = dose.toUpperCase();
  } else if (!isLiquidOrPack) {
    const mlMatch = upperName.match(/(\d+(?:\.\d+)?\s*ML)/i);
    if (mlMatch && parseFloat(mlMatch[1]) <= 10) {
      dose = mlMatch[1].replace(/\s+/g, '').toLowerCase();
    }
  }

  if (!dose) {
    if (type === 'Tablet') dose = '1 tab';
    else if (type === 'Capsule') dose = '1 cap';
    else if (type === 'Syrup' || type === 'Suspension') dose = '5ml';
    else if (type === 'Drops') dose = '2-3 drops';
    else if (type === 'Injection') dose = '1 ampoule';
    else if (['Ointment', 'Cream', 'Gel', 'Lotion', 'Patch'].includes(type)) dose = 'Apply locally';
    else if (['Inhaler', 'Respule'].includes(type)) dose = '1-2 puffs';
    else if (type === 'Sachet') dose = '1 sachet';
    else dose = '1 unit';
  }

  // 4. FREQUENCY
  let frequency = '1-0-1';
  if (type === 'Injection') {
    frequency = upperName.includes('SOS') ? 'SOS' : 'Once daily';
  } else if (['Ointment', 'Cream', 'Gel', 'Lotion'].includes(type)) {
    frequency = '2-3 times daily';
  } else if (type === 'Drops') {
    frequency = '1-0-1 (2 drops)';
  } else if (type === 'Inhaler') {
    frequency = '1-0-1 (As needed)';
  } else if (upperName.includes('STAT') || upperName.includes('SOS')) {
    frequency = 'SOS';
  } else if (upperCat.includes('ANTACID') || upperCat.includes('ANTIULCER') || upperName.startsWith('PAN ') || upperName.startsWith('RAB') || upperName.startsWith('OME')) {
    frequency = '1-0-0';
  } else if (upperCat.includes('ANTIHISTAMINE') || upperCat.includes('LIPID') || upperName.includes('CETIRIZINE') || upperName.includes('STATIN') || upperName.includes('MONTELUKAST')) {
    frequency = '0-0-1';
  } else if (upperCat.includes('ANTIBIOTIC')) {
    frequency = upperName.includes('AZITHRO') ? '1-0-0' : '1-0-1';
  } else if (upperCat.includes('THYROID')) {
    frequency = '1-0-0';
  }

  // 5. DURATION
  let duration = '5 days';
  if (type === 'Injection') {
    duration = '1 day';
  } else if (upperCat.includes('ANTIDIABETIC') || upperCat.includes('ANTIHYPERTENSIVE') || upperCat.includes('CARDIOVASCULAR') || upperCat.includes('THYROID') || upperCat.includes('LIPID')) {
    duration = '30 days';
  } else if (upperCat.includes('CALCIUM') || upperCat.includes('VITAMIN') || upperCat.includes('SUPPLEMENT')) {
    duration = '30 days';
  } else if (upperCat.includes('ANTIULCER') || upperCat.includes('ANTACID')) {
    duration = '14 days';
  } else if (type === 'Ointment' || type === 'Cream' || type === 'Gel') {
    duration = '7 days';
  } else if (type === 'Drops') {
    duration = '5 days';
  } else {
    duration = '5 days';
  }

  // 6. NOTES
  const noteParts = [];
  if (categoryName && categoryName.trim() && categoryName !== 'Other') {
    noteParts.push(`Category: ${categoryName.trim()}`);
  }
  if (company && company.trim()) {
    noteParts.push(`Mfg: ${company.trim()}`);
  }
  if (rawNote && rawNote.trim()) {
    noteParts.push(rawNote.trim());
  }
  if (frequency === '1-0-0' && (upperCat.includes('ANTIULCER') || upperCat.includes('ANTACID') || upperName.startsWith('PAN '))) {
    noteParts.push('Take on empty stomach 30 mins before breakfast.');
  } else if (frequency === '0-0-1') {
    noteParts.push('Take at bedtime.');
  } else if (route === 'Oral' && type !== 'Syrup' && !upperCat.includes('ANTIULCER')) {
    noteParts.push('Take after food.');
  } else if (route === 'Topical') {
    noteParts.push('Apply gently over affected area.');
  }
  const notes = noteParts.join(' | ') || 'As prescribed by physician.';

  return { type, route, dose, frequency, duration, notes };
}

export async function translateSqlToJson() {
  console.log(`📖 Reading SQL dump from: ${sqlFilePath}`);
  if (!fs.existsSync(sqlFilePath)) {
    throw new Error(`File not found: ${sqlFilePath}`);
  }

  const categoryMap = {};
  const rl = readline.createInterface({
    input: fs.createReadStream(sqlFilePath),
    crlfDelay: Infinity
  });

  let inCategories = false;
  let inPharmacy = false;
  const medicineMap = new Map();

  for await (const line of rl) {
    if (line.includes('INSERT INTO `medicine_category`')) {
      inCategories = true;
      continue;
    }
    if (inCategories) {
      const match = line.match(/\((\d+),\s*'([^']+)'/);
      if (match) {
        categoryMap[match[1]] = match[2];
      }
      if (line.trim().endsWith(';')) inCategories = false;
    }

    if (line.includes('INSERT INTO `pharmacy`')) {
      inPharmacy = true;
      continue;
    }
    if (inPharmacy) {
      const trimmed = line.trim();
      if (trimmed.startsWith('(')) {
        const tokens = parseSqlValues(trimmed);
        const name = (tokens[1] || '').replace(/\s+/g, ' ').trim();
        const catId = tokens[2];
        const categoryName = categoryMap[catId] || '';
        const company = (tokens[4] || '').replace(/\s+/g, ' ').trim();
        const rawComp = (tokens[5] || '').replace(/\s+/g, ' ').trim();
        const unit = (tokens[7] || '').trim();
        const rawNote = (tokens[14] || '').replace(/\s+/g, ' ').trim();

        if (!name) continue;

        const composition = cleanComposition(rawComp, name);
        const details = inferMedicineDetails(name, categoryName, unit, composition, company, rawNote);

        const medObj = {
          name,
          composition,
          ...details
        };

        const key = name.toLowerCase();
        // If duplicate name, keep the one with composition if existing has no composition
        if (medicineMap.has(key)) {
          const existing = medicineMap.get(key);
          if (existing.composition.length === 0 && composition.length > 0) {
            medicineMap.set(key, medObj);
          }
        } else {
          medicineMap.set(key, medObj);
        }
      }
      if (trimmed.endsWith(';')) inPharmacy = false;
    }
  }

  const allMedicines = Array.from(medicineMap.values());
  console.log(`✅ Successfully parsed and translated ${allMedicines.length} unique medicines.`);

  fs.writeFileSync(outputJsonPath, JSON.stringify(allMedicines, null, 2), 'utf-8');
  console.log(`💾 Saved translated medicines JSON to: ${outputJsonPath}`);

  return allMedicines;
}

// Run directly if called as main module
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  translateSqlToJson()
    .then((meds) => {
      console.log(`🎉 Translation completed successfully! Total records: ${meds.length}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Translation failed:', err);
      process.exit(1);
    });
}
