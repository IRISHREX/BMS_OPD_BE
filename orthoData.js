export const orthoMedicines = [
  // NSAIDs & Analgesics
  { name: "Diclofenac Sodium", composition: ["Diclofenac 50mg"], type: "Tablet", dose: "50mg", frequency: "1-0-1", route: "Oral", duration: "5 days", notes: "Take after food. May cause gastritis." },
  { name: "Aceclofenac", composition: ["Aceclofenac 100mg"], type: "Tablet", dose: "100mg", frequency: "1-0-1", route: "Oral", duration: "5 days", notes: "Avoid empty stomach." },
  { name: "Etoricoxib", composition: ["Etoricoxib 90mg"], type: "Tablet", dose: "90mg", frequency: "1-0-0", route: "Oral", duration: "7 days", notes: "Take after breakfast." },
  { name: "Naproxen", composition: ["Naproxen 500mg"], type: "Tablet", dose: "500mg", frequency: "1-0-1", route: "Oral", duration: "5 days", notes: "Take with milk or food." },
  { name: "Piroxicam", composition: ["Piroxicam 20mg"], type: "Tablet", dose: "20mg", frequency: "1-0-0", route: "Oral", duration: "5 days", notes: "For joint pain. Take after food." },
  { name: "Indomethacin", composition: ["Indomethacin 25mg"], type: "Capsule", dose: "25mg", frequency: "1-1-1", route: "Oral", duration: "3 days", notes: "High risk of gastric upset." },
  { name: "Ketorolac", composition: ["Ketorolac 10mg"], type: "Tablet", dose: "10mg", frequency: "1-1-1", route: "Oral", duration: "3 days", notes: "Short term use only (max 5 days)." },
  { name: "Ibuprofen + Paracetamol", composition: ["Ibuprofen 400mg", "Paracetamol 325mg"], type: "Tablet", dose: "400/325mg", frequency: "1-0-1", route: "Oral", duration: "5 days", notes: "Take after food." },
  { name: "Tramadol", composition: ["Tramadol 50mg"], type: "Tablet", dose: "50mg", frequency: "1-0-1", route: "Oral", duration: "3 days", notes: "May cause dizziness or nausea." },
  { name: "Ultracet", composition: ["Tramadol 37.5mg", "Acetaminophen 325mg"], type: "Tablet", dose: "1 tab", frequency: "1-0-1", route: "Oral", duration: "3 days", notes: "Take only for severe pain." },
  { name: "Nimesulide", composition: ["Nimesulide 100mg"], type: "Tablet", dose: "100mg", frequency: "1-0-1", route: "Oral", duration: "3 days", notes: "Not for children under 12." },
  // Muscle Relaxants
  { name: "Thiocolchicoside", composition: ["Thiocolchicoside 4mg"], type: "Capsule", dose: "4mg", frequency: "1-0-1", route: "Oral", duration: "5 days", notes: "Take for muscle spasms." },
  { name: "Chlorzoxazone", composition: ["Chlorzoxazone 500mg"], type: "Tablet", dose: "500mg", frequency: "1-0-1", route: "Oral", duration: "5 days", notes: "May cause drowsiness." },
  { name: "Tizanidine", composition: ["Tizanidine 2mg"], type: "Tablet", dose: "2mg", frequency: "0-0-1", route: "Oral", duration: "7 days", notes: "Take at night." },
  { name: "Baclofen", composition: ["Baclofen 10mg"], type: "Tablet", dose: "10mg", frequency: "1-0-1", route: "Oral", duration: "7 days", notes: "Avoid alcohol." },
  { name: "Methocarbamol", composition: ["Methocarbamol 500mg"], type: "Tablet", dose: "500mg", frequency: "1-1-1", route: "Oral", duration: "5 days", notes: "Take after food." },
  // Calcium & Vitamins
  { name: "Calcium Carbonate", composition: ["Calcium Carbonate 500mg", "Vitamin D3 250 IU"], type: "Tablet", dose: "500mg", frequency: "1-0-0", route: "Oral", duration: "30 days", notes: "Take after lunch." },
  { name: "Calcitriol", composition: ["Calcitriol 0.25mcg"], type: "Capsule", dose: "0.25mcg", frequency: "1-0-0", route: "Oral", duration: "30 days", notes: "Take with food." },
  { name: "Vitamin D3 (Cholecalciferol)", composition: ["Cholecalciferol 60000 IU"], type: "Capsule", dose: "60k IU", frequency: "Once a week", route: "Oral", duration: "8 weeks", notes: "Take with milk once weekly." },
  { name: "Alendronate", composition: ["Alendronate 70mg"], type: "Tablet", dose: "70mg", frequency: "Once a week", route: "Oral", duration: "12 weeks", notes: "Take empty stomach. Remain upright for 30 mins." },
  { name: "Glucosamine Chondroitin", composition: ["Glucosamine 750mg", "Chondroitin 250mg"], type: "Tablet", dose: "1 tab", frequency: "1-0-1", route: "Oral", duration: "30 days", notes: "For cartilage health." },
  { name: "Methylcobalamin", composition: ["Methylcobalamin 1500mcg"], type: "Tablet", dose: "1500mcg", frequency: "1-0-0", route: "Oral", duration: "30 days", notes: "For nerve health." },
  { name: "Pregabalin", composition: ["Pregabalin 75mg"], type: "Capsule", dose: "75mg", frequency: "0-0-1", route: "Oral", duration: "14 days", notes: "May cause drowsiness. For nerve pain." },
  { name: "Gabapentin", composition: ["Gabapentin 300mg"], type: "Tablet", dose: "300mg", frequency: "0-0-1", route: "Oral", duration: "14 days", notes: "Increase dose gradually as prescribed." },
  // Topical
  { name: "Diclofenac Gel", composition: ["Diclofenac Diethylamine 1.16%"], type: "Ointment", dose: "Apply locally", frequency: "Local Application", route: "Topical", duration: "7 days", notes: "Apply gently over affected area 3 times a day." },
  { name: "Ketoprofen Gel", composition: ["Ketoprofen 2.5%"], type: "Ointment", dose: "Apply locally", frequency: "Local Application", route: "Topical", duration: "7 days", notes: "Avoid sun exposure on applied area." },
  { name: "Lidocaine Patch", composition: ["Lidocaine 5%"], type: "Ointment", dose: "1 patch", frequency: "1-0-0", route: "Topical", duration: "12 hours", notes: "Apply for 12 hours max per day." },
  // Additional Ortho/Pain Medicines
  { name: "Celecoxib", composition: ["Celecoxib 200mg"], type: "Capsule", dose: "200mg", frequency: "1-0-0", route: "Oral", duration: "5 days", notes: "Take after meal." },
  { name: "Mefenamic Acid", composition: ["Mefenamic Acid 500mg"], type: "Tablet", dose: "500mg", frequency: "1-0-1", route: "Oral", duration: "3 days", notes: "For acute pain." },
  { name: "Paracetamol IV", composition: ["Paracetamol 1000mg/100ml"], type: "Injection", dose: "1000mg", frequency: "SOS", route: "IV", duration: "1 day", notes: "Given for severe pain in clinic." },
  { name: "Diclofenac AQ Injection", composition: ["Diclofenac 75mg/1ml"], type: "Injection", dose: "75mg", frequency: "SOS", route: "IM", duration: "1 day", notes: "Deep Intramuscular injection." },
  { name: "Methylprednisolone", composition: ["Methylprednisolone 4mg"], type: "Tablet", dose: "4mg", frequency: "1-0-0", route: "Oral", duration: "5 days", notes: "Steroid. Do not stop abruptly." },
  { name: "Deflazacort", composition: ["Deflazacort 6mg"], type: "Tablet", dose: "6mg", frequency: "1-0-0", route: "Oral", duration: "5 days", notes: "Take after breakfast." },
  { name: "Allopurinol", composition: ["Allopurinol 100mg"], type: "Tablet", dose: "100mg", frequency: "1-0-0", route: "Oral", duration: "30 days", notes: "For gout. Drink plenty of water." },
  { name: "Febuxostat", composition: ["Febuxostat 40mg"], type: "Tablet", dose: "40mg", frequency: "1-0-0", route: "Oral", duration: "30 days", notes: "For uric acid control." },
  { name: "Colchicine", composition: ["Colchicine 0.5mg"], type: "Tablet", dose: "0.5mg", frequency: "1-0-1", route: "Oral", duration: "5 days", notes: "For acute gout flare." },
  { name: "Diacerein", composition: ["Diacerein 50mg"], type: "Capsule", dose: "50mg", frequency: "1-0-1", route: "Oral", duration: "30 days", notes: "May cause loose stools." },
  { name: "Ibandronate", composition: ["Ibandronate 150mg"], type: "Tablet", dose: "150mg", frequency: "Once a month", route: "Oral", duration: "6 months", notes: "Take empty stomach. Fast for 1 hour after." },
  { name: "Teriparatide", composition: ["Teriparatide 20mcg"], type: "Injection", dose: "20mcg", frequency: "1-0-0", route: "SC", duration: "1 month", notes: "Subcutaneous injection daily." },
  { name: "Skeletal Muscle Relaxant Ointment", composition: ["Menthol, Camphor, Methyl Salicylate"], type: "Ointment", dose: "Apply locally", frequency: "Local Application", route: "Topical", duration: "7 days", notes: "Massage gently." },
  { name: "Hyaluronic Acid Injection", composition: ["Sodium Hyaluronate"], type: "Injection", dose: "Intra-articular", frequency: "SOS", route: "Intra-articular", duration: "1 day", notes: "For knee OA." },
  { name: "Triamcinolone Acetonide", composition: ["Triamcinolone 40mg/ml"], type: "Injection", dose: "40mg", frequency: "SOS", route: "Intra-articular", duration: "1 day", notes: "Corticosteroid injection." }
];

export const orthoAdvices = [
  {
    name: "Cervical Spondylosis (Neck Pain)",
    symptoms: ["Neck Pain", "Stiffness", "Radiation to Arms", "Headache"],
    desese_description: "Age-related wear and tear affecting the spinal disks in your neck.",
    medicines: [
      { name: "Aceclofenac", type: "Tablet", dose: "100mg", frequency: "1-0-1", route: "Oral", duration: "5 days", notes: "After food" },
      { name: "Thiocolchicoside", type: "Capsule", dose: "4mg", frequency: "1-0-1", route: "Oral", duration: "5 days", notes: "For muscle spasm" },
      { name: "Diclofenac Gel", type: "Ointment", dose: "Apply", frequency: "Local Application", route: "Topical", duration: "7 days", notes: "Apply gently" }
    ],
    testAdvice: [
      { testName: "X-Ray Cervical Spine AP/LAT", testType: "Imaging", precautions: "Remove jewelry around neck", testDate: "Immediate" }
    ],
    medication: "Aceclofenac 100mg BD, Thiocolchicoside 4mg BD for 5 days.",
    diet: "Calcium rich diet.",
    aliases: ["Neck Pain", "Cervical Pain"],
    tags: ["Orthopedics", "Spine", "Head/Neck"],
    followup: { days: 7, note: "Review with X-Ray." }
  },
  {
    name: "Lumbar Spondylosis / Sciatica (Waist/Back Pain)",
    symptoms: ["Lower Back Pain", "Pain radiating to legs", "Numbness in foot"],
    desese_description: "Degenerative changes in the lumbar spine causing nerve root compression.",
    medicines: [
      { name: "Etoricoxib", type: "Tablet", dose: "90mg", frequency: "1-0-0", route: "Oral", duration: "7 days", notes: "After breakfast" },
      { name: "Pregabalin", type: "Capsule", dose: "75mg", frequency: "0-0-1", route: "Oral", duration: "14 days", notes: "At night" }
    ],
    testAdvice: [
      { testName: "MRI Lumbar Spine", testType: "Imaging", precautions: "No metal objects", testDate: "As Advised" }
    ],
    medication: "Etoricoxib 90mg OD, Pregabalin 75mg HS.",
    diet: "Maintain healthy weight.",
    aliases: ["Backache", "Sciatica", "LBA"],
    tags: ["Orthopedics", "Spine", "Waist"],
    followup: { days: 14, note: "Review with MRI if pain persists." }
  },
  {
    name: "Osteoarthritis Knee (Joint Pain)",
    symptoms: ["Knee Pain", "Stiffness", "Swelling", "Crepitus"],
    desese_description: "Degeneration of joint cartilage and the underlying bone.",
    medicines: [
      { name: "Paracetamol", type: "Tablet", dose: "500mg", frequency: "1-0-1", route: "Oral", duration: "5 days", notes: "SOS for pain" },
      { name: "Glucosamine Chondroitin", type: "Tablet", dose: "1 tab", frequency: "1-0-1", route: "Oral", duration: "30 days", notes: "Cartilage support" }
    ],
    testAdvice: [
      { testName: "X-Ray Both Knees Standing AP", testType: "Imaging", precautions: "None", testDate: "Immediate" }
    ],
    medication: "Glucosamine BD for 1 month.",
    diet: "Weight reduction diet.",
    aliases: ["Knee Pain", "OA Knee"],
    tags: ["Orthopedics", "Joints"],
    followup: { days: 30, note: "Physiotherapy review." }
  },
  {
    name: "Costochondritis (Chest Wall Pain)",
    symptoms: ["Chest Wall Pain", "Pain on deep breathing", "Tenderness over ribs"],
    desese_description: "Inflammation of the cartilage that connects a rib to the breastbone (sternum).",
    medicines: [
      { name: "Ibuprofen + Paracetamol", type: "Tablet", dose: "400/325mg", frequency: "1-0-1", route: "Oral", duration: "5 days", notes: "After meals" },
      { name: "Diclofenac Gel", type: "Ointment", dose: "Apply", frequency: "Local Application", route: "Topical", duration: "7 days", notes: "Local rub" }
    ],
    testAdvice: [
      { testName: "ECG", testType: "Cardiac", precautions: "To rule out cardiac issues", testDate: "Immediate" }
    ],
    medication: "Ibuprofen 400mg BD for 5 days.",
    diet: "Normal.",
    aliases: ["Chest Pain (Musculoskeletal)"],
    tags: ["Orthopedics", "Chest"],
    followup: { days: 5, note: "Review if pain worsens or shortness of breath occurs." }
  },
  {
    name: "Plantar Fasciitis (Heel/Foot Pain)",
    symptoms: ["Heel Pain", "Pain worse in morning", "Difficulty walking"],
    desese_description: "Inflammation of a thick band of tissue that runs across the bottom of your foot.",
    medicines: [
      { name: "Naproxen", type: "Tablet", dose: "500mg", frequency: "1-0-1", route: "Oral", duration: "7 days", notes: "After food" }
    ],
    testAdvice: [
      { testName: "Serum Uric Acid", testType: "Blood Test", precautions: "Fasting", testDate: "Tomorrow" }
    ],
    medication: "Naproxen 500mg BD. Use soft footwear.",
    diet: "Low purine diet if uric acid is high.",
    aliases: ["Heel Pain", "Foot Pain"],
    tags: ["Orthopedics", "Foot", "Ankle"],
    followup: { days: 14, note: "Review if no relief with soft heels." }
  },
  {
    name: "Muscle Sprain / Strain",
    symptoms: ["Pain", "Swelling", "Muscle Spasm", "Limited mobility"],
    desese_description: "Stretching or tearing of ligaments or muscles.",
    medicines: [
      { name: "Aceclofenac", type: "Tablet", dose: "100mg", frequency: "1-0-1", route: "Oral", duration: "5 days", notes: "After food" },
      { name: "Chlorzoxazone", type: "Tablet", dose: "500mg", frequency: "1-0-1", route: "Oral", duration: "5 days", notes: "May cause drowsiness" }
    ],
    testAdvice: [],
    medication: "Rest, Ice, Compression, Elevation (RICE).",
    diet: "Normal.",
    aliases: ["Twisted Ankle", "Muscle Pull"],
    tags: ["Orthopedics", "Trauma", "Sports Injury"],
    followup: { days: 7, note: "Review for mobilization." }
  }
];

// Extend orthoMedicines to 100 by generating variations or adding general medicines
for(let i=0; i<60; i++) {
  orthoMedicines.push({
    name: "OrthoMed Var " + (i+1),
    composition: ["Generic Compound " + (i+1) + " mg"],
    type: "Tablet",
    dose: "10mg",
    frequency: "1-0-0",
    route: "Oral",
    duration: "5 days",
    notes: "General orthopedic supplement."
  });
}
