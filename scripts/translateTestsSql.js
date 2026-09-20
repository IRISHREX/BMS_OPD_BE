import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pathologySqlPath = path.resolve(__dirname, '../../pathology.sql');
const radioSqlPath = path.resolve(__dirname, '../../radio.sql');
const outputJsonPath = path.resolve(__dirname, '../diagnosticTests.json');

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
  return tokens.map((t) => (t === 'NULL' ? null : t));
}

function cleanTestName(name, shortName) {
  let cleaned = (name || '').replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/^X\s*-\s*RAY/i, 'X-RAY');
  cleaned = cleaned.replace(/\bX\s*-\s*RAY\b/gi, 'X-RAY');

  if (shortName && shortName.trim()) {
    const s = shortName.trim();
    if (s.length >= 2 && s.length <= 10 && !cleaned.toLowerCase().includes(s.toLowerCase())) {
      cleaned = `${cleaned} (${s})`;
    }
  }
  return cleaned;
}

function inferPathologyDetails(name, shortName, method, reportDays, price) {
  const upper = (name || '').toUpperCase();
  let type = 'Blood Test';
  let precautions = 'None';
  let department = 'Pathology';

  if (upper.includes('URINE')) {
    type = 'Urine Test';
    precautions = 'First morning mid-stream clean catch sample';
    department = 'Clinical Pathology';
  } else if (upper.includes('STOOL')) {
    type = 'Stool Examination';
    precautions = 'Collect in clean, dry, leak-proof container';
    department = 'Clinical Pathology';
  } else if (upper.includes('SEMEN')) {
    type = 'Semen Analysis';
    precautions = '2-3 days of sexual abstinence recommended';
    department = 'Clinical Pathology';
  } else if (upper.includes('SPUTUM')) {
    type = 'Sputum Examination';
    precautions = 'Early morning deep cough sample before eating or drinking';
    department = 'Microbiology';
  } else if (upper.includes('CULTURE') || upper.includes('SENSITIVITY') || upper.includes('GRAM STAIN') || upper.includes('AFB')) {
    type = 'Microbiology';
    precautions = 'Sample must be collected before starting antibiotics';
    department = 'Microbiology';
  } else if (upper.includes('BIOPSY') || upper.includes('FNAC') || upper.includes('HISTOPATH') || upper.includes('PAP SMEAR')) {
    type = 'Histopathology';
    precautions = 'As directed by physician';
    department = 'Histopathology';
  } else if (upper.includes('FASTING') || upper.includes('FBS') || upper.includes('LIPID') || upper.includes('TRIGLYCERIDE') || upper.includes('CHOLESTEROL')) {
    type = 'Blood Test';
    precautions = 'Fasting 8-10 hours required';
    department = 'Biochemistry';
  } else if (upper.includes('PPBS') || upper.includes('POST PRANDIAL')) {
    type = 'Blood Test';
    precautions = 'Collect sample 2 hours after meal';
    department = 'Biochemistry';
  } else if (upper.includes('THYROID') || upper.includes('T3') || upper.includes('T4') || upper.includes('TSH') || upper.includes('VITAMIN') || upper.includes('FERRITIN') || upper.includes('CORTISOL') || upper.includes('INSULIN')) {
    type = 'Blood Test';
    precautions = 'Morning fasting sample preferred';
    department = 'Endocrinology';
  } else if (upper.includes('CBC') || upper.includes('HEMOGLOBIN') || upper.includes('PLATELET') || upper.includes('BLOOD GROUP') || upper.includes('ESR') || upper.includes('LEUKOCYTE') || upper.includes('MALARIA')) {
    type = 'Blood Test';
    precautions = 'None';
    department = 'Hematology';
  } else if (upper.includes('WIDAL') || upper.includes('DENGUE') || upper.includes('HIV') || upper.includes('HBSAG') || upper.includes('HCV') || upper.includes('VDRL') || upper.includes('CRP') || upper.includes('RA FACTOR') || upper.includes('ASO') || upper.includes('TYPHI')) {
    type = 'Blood Test';
    precautions = 'None';
    department = 'Serology';
  } else if (upper.includes('LFT') || upper.includes('LIVER') || upper.includes('KFT') || upper.includes('RFT') || upper.includes('CREATININE') || upper.includes('UREA') || upper.includes('ELECTROLYTE') || upper.includes('BILIRUBIN') || upper.includes('SGOT') || upper.includes('SGPT') || upper.includes('AMYLASE') || upper.includes('LIPASE') || upper.includes('CALCIUM') || upper.includes('PROTEIN') || upper.includes('ALBUMIN')) {
    type = 'Blood Test';
    precautions = 'Fasting preferred';
    department = 'Biochemistry';
  }

  const descParts = [];
  if (method && method.trim()) descParts.push(`Method: ${method.trim()}`);
  if (reportDays && reportDays !== '0') descParts.push(`Report available in ${reportDays} days`);
  const description = descParts.join('. ') || 'Diagnostic laboratory pathology test.';

  return { type, precautions, department, description, normalRange: '', price: price || 0 };
}

function inferRadiologyDetails(name, shortName, reportDays, price) {
  const upper = (name || '').toUpperCase();
  let type = 'Imaging';
  let precautions = 'Remove metallic objects, jewelry, and belts';
  let department = 'Radiology';

  if (upper.includes('X-RAY') || upper.includes('X -RAY')) {
    type = 'X-Ray';
    precautions = 'Remove metallic objects, jewelry, and belts';
  } else if (upper.includes('USG') || upper.includes('ULTRASOUND') || upper.includes('SONO')) {
    type = 'Ultrasound';
    if (upper.includes('ABDOMEN') || upper.includes('LIVER') || upper.includes('GALL') || upper.includes('KUB')) {
      precautions = 'Fasting for 6 hours prior to test. Full bladder for pelvic examination.';
    } else {
      precautions = 'None';
    }
  } else if (upper.includes('CT') || upper.includes('HRCT') || upper.includes('COMPUTED')) {
    type = 'CT Scan';
    precautions = '4-6 hours fasting for contrast studies. Remove all metallic items.';
  } else if (upper.includes('MRI')) {
    type = 'MRI';
    precautions = 'Strictly no cardiac pacemakers, metallic implants, or ferromagnetic objects.';
  } else if (upper.includes('ECHO') || upper.includes('ECG')) {
    type = 'Cardiology';
    precautions = 'Rest quietly 10 minutes before examination';
    department = 'Cardiology';
  } else if (upper.includes('MAMMO')) {
    type = 'Mammography';
    precautions = 'Do not use deodorant, talcum powder, or lotions under the arms';
  }

  const descParts = [];
  descParts.push('Radiological diagnostic imaging.');
  if (reportDays && reportDays !== '0') descParts.push(`Report available in ${reportDays} days`);
  const description = descParts.join('. ');

  return { type, precautions, department, description, normalRange: 'N/A - Radiologist Descriptive Report', price: price || 0 };
}

export async function translateTestsSqlToJson() {
  console.log(`📖 Reading SQL files:\n - Pathology: ${pathologySqlPath}\n - Radio: ${radioSqlPath}`);

  const chargesMap = {};

  // 1. Read charges from radio.sql if present
  if (fs.existsSync(radioSqlPath)) {
    const rlCharges = readline.createInterface({
      input: fs.createReadStream(radioSqlPath),
      crlfDelay: Infinity,
    });
    let inCharges = false;
    for await (const line of rlCharges) {
      if (line.includes('INSERT INTO `charges`')) {
        inCharges = true;
        continue;
      }
      if (inCharges) {
        const trimmed = line.trim();
        if (trimmed.startsWith('(')) {
          const tokens = parseSqlValues(trimmed);
          chargesMap[tokens[0]] = parseFloat(tokens[5]) || 0;
        }
        if (trimmed.endsWith(';')) inCharges = false;
      }
    }
    console.log(`   + Loaded ${Object.keys(chargesMap).length} test charge rates.`);
  }

  const testMap = new Map();

  // 2. Parse Pathology Tests
  if (fs.existsSync(pathologySqlPath)) {
    const rlPath = readline.createInterface({
      input: fs.createReadStream(pathologySqlPath),
      crlfDelay: Infinity,
    });
    let inPath = false;
    let pathCount = 0;
    for await (const line of rlPath) {
      if (line.includes('INSERT INTO `pathology`')) {
        inPath = true;
        continue;
      }
      if (inPath) {
        const trimmed = line.trim();
        if (trimmed.startsWith('(')) {
          const tokens = parseSqlValues(trimmed);
          const rawName = tokens[1];
          const shortName = tokens[2];
          const reportDays = tokens[7];
          const method = tokens[8];
          const chargeId = tokens[9];
          const price = chargesMap[chargeId] || 0;

          if (rawName && rawName.trim() && rawName !== 'NULL') {
            const name = cleanTestName(rawName, shortName);
            const details = inferPathologyDetails(name, shortName, method, reportDays, price);
            const key = name.toLowerCase();
            testMap.set(key, { name, ...details });
            pathCount++;
          }
        }
        if (trimmed.endsWith(';')) inPath = false;
      }
    }
    console.log(`   + Parsed ${pathCount} pathology tests.`);
  }

  // 3. Parse Radiology Tests
  if (fs.existsSync(radioSqlPath)) {
    const rlRadio = readline.createInterface({
      input: fs.createReadStream(radioSqlPath),
      crlfDelay: Infinity,
    });
    let inRadio = false;
    let radioCount = 0;
    for await (const line of rlRadio) {
      if (line.includes('INSERT INTO `radio`')) {
        inRadio = true;
        continue;
      }
      if (inRadio) {
        const trimmed = line.trim();
        if (trimmed.startsWith('(')) {
          const tokens = parseSqlValues(trimmed);
          const rawName = tokens[1];
          const shortName = tokens[2];
          const reportDays = tokens[6];
          const chargeId = tokens[7];
          const price = chargesMap[chargeId] || 0;

          if (rawName && rawName.trim() && rawName !== 'NULL') {
            const name = cleanTestName(rawName, shortName);
            const details = inferRadiologyDetails(name, shortName, reportDays, price);
            const key = name.toLowerCase();
            testMap.set(key, { name, ...details });
            radioCount++;
          }
        }
        if (trimmed.endsWith(';')) inRadio = false;
      }
    }
    console.log(`   + Parsed ${radioCount} radiology tests.`);
  }

  const allTests = Array.from(testMap.values());
  console.log(`✅ Total unique translated diagnostic tests: ${allTests.length}`);

  fs.writeFileSync(outputJsonPath, JSON.stringify(allTests, null, 2), 'utf-8');
  console.log(`💾 Saved translated tests JSON to: ${outputJsonPath}`);

  return allTests;
}

// Run directly if called as script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  translateTestsSqlToJson()
    .then((tests) => {
      console.log(`🎉 Diagnostic tests translation finished successfully! Total: ${tests.length}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Failed to translate diagnostic tests:', err);
      process.exit(1);
    });
}
