import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Medicine } from './models/medicineSchema.js';
import { MedicalAdvice } from './models/medicalAdviceSchema.js';
import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

mongoose
  .connect(MONGO_URI, { dbName: 'MERN_STACK_HOSPITAL_MANAGEMENT' })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  });

const seedData = async () => {
  try {
    const medicines = [
      { name: 'Paracetamol', composition: ['Paracetamol 500mg'], type: 'Tablet', dose: '500 mg', frequency: '1-1-1', route: 'Oral', duration: '3 Days', notes: 'After meals' },
      { name: 'Ibuprofen', composition: ['Ibuprofen 400mg'], type: 'Tablet', dose: '400 mg', frequency: '1-0-1', route: 'Oral', duration: '5 Days', notes: 'Take with food' },
      { name: 'Diclofenac Sodium', composition: ['Diclofenac 50mg'], type: 'Tablet', dose: '50 mg', frequency: '1-0-1', route: 'Oral', duration: '5 Days', notes: 'Avoid on empty stomach' },
      { name: 'Tramadol', composition: ['Tramadol 50mg'], type: 'Capsule', dose: '50 mg', frequency: '1-0-1', route: 'Oral', duration: '3 Days', notes: 'May cause drowsiness' },
      { name: 'Calcium + Vitamin D3', composition: ['Calcium 500mg', 'Cholecalciferol 250 IU'], type: 'Tablet', dose: '1 Tab', frequency: '1-0-0', route: 'Oral', duration: '30 Days', notes: 'Take after breakfast' },
      { name: 'Etoricoxib', composition: ['Etoricoxib 90mg'], type: 'Tablet', dose: '90 mg', frequency: '1-0-0', route: 'Oral', duration: '5 Days', notes: 'For acute pain' },
      { name: 'Pantoprazole', composition: ['Pantoprazole 40mg'], type: 'Tablet', dose: '40 mg', frequency: '1-0-0', route: 'Oral', duration: '7 Days', notes: 'Empty stomach in morning' },
      { name: 'Pregabalin', composition: ['Pregabalin 75mg'], type: 'Capsule', dose: '75 mg', frequency: '0-0-1', route: 'Oral', duration: '14 Days', notes: 'For nerve pain' },
      { name: 'Thiocolchicoside', composition: ['Thiocolchicoside 4mg'], type: 'Capsule', dose: '4 mg', frequency: '1-0-1', route: 'Oral', duration: '5 Days', notes: 'Muscle relaxant' },
      { name: 'Amoxicillin + Clavulanic Acid', composition: ['Amoxicillin 500mg', 'Clavulanic Acid 125mg'], type: 'Tablet', dose: '625 mg', frequency: '1-0-1', route: 'Oral', duration: '7 Days', notes: 'Complete the full course' },
      { name: 'Methylprednisolone', composition: ['Methylprednisolone 4mg'], type: 'Tablet', dose: '4 mg', frequency: '1-0-0', route: 'Oral', duration: '5 Days', notes: 'Take exactly as prescribed' },
      { name: 'Aceclofenac + Paracetamol', composition: ['Aceclofenac 100mg', 'Paracetamol 325mg'], type: 'Tablet', dose: '1 Tab', frequency: '1-0-1', route: 'Oral', duration: '5 Days', notes: 'For pain and inflammation' },
      { name: 'Methocarbamol', composition: ['Methocarbamol 500mg'], type: 'Tablet', dose: '500 mg', frequency: '1-0-1', route: 'Oral', duration: '5 Days', notes: 'Muscle relaxant' }
    ];

    for (const med of medicines) {
      await Medicine.findOneAndUpdate({ name: med.name }, med, { upsert: true, new: true });
    }
    console.log('Medicines seeded successfully!');

    const orthoAdvices = [
      {
        name: 'Osteoarthritis Knee',
        symptoms: ['Knee pain', 'Joint stiffness', 'Swelling', 'Crepitus'],
        medicines: [
          { name: 'Paracetamol', type: 'Tablet', dose: '500 mg', frequency: '1-1-1', route: 'Oral', duration: '5 Days', notes: 'For pain relief' },
          { name: 'Calcium + Vitamin D3', type: 'Tablet', dose: '1 Tab', frequency: '1-0-0', route: 'Oral', duration: '30 Days', notes: 'Supplement' }
        ],
        testAdvice: [
          { testName: 'X-Ray Knee AP/LAT View', testType: 'Imaging', precautions: 'Remove metallic objects', testDate: 'Immediate' },
          { testName: 'Serum Uric Acid', testType: 'Blood', precautions: 'Fasting', testDate: 'Next morning' },
          { testName: 'CRP (C-Reactive Protein)', testType: 'Blood', precautions: 'None', testDate: 'Immediate' }
        ],
        diet: 'Maintain healthy weight. Consume calcium-rich foods.',
        desese_description: 'Degenerative joint disease of the knee.',
        tags: ['Ortho', 'Knee', 'Arthritis']
      },
      {
        name: 'Lumbar Spondylosis',
        symptoms: ['Lower back pain', 'Stiffness in the lower back', 'Numbness or tingling'],
        medicines: [
          { name: 'Etoricoxib', type: 'Tablet', dose: '90 mg', frequency: '1-0-0', route: 'Oral', duration: '5 Days', notes: 'Pain relief' },
          { name: 'Thiocolchicoside', type: 'Capsule', dose: '4 mg', frequency: '1-0-1', route: 'Oral', duration: '5 Days', notes: 'Muscle relaxant' },
          { name: 'Pantoprazole', type: 'Tablet', dose: '40 mg', frequency: '1-0-0', route: 'Oral', duration: '5 Days', notes: 'Gastric protection' }
        ],
        testAdvice: [
          { testName: 'X-Ray Lumbosacral Spine AP/LAT', testType: 'Imaging', precautions: '', testDate: 'Immediate' },
          { testName: 'MRI Lumbar Spine', testType: 'Imaging', precautions: 'No pacemaker', testDate: 'If pain persists' }
        ],
        diet: 'Avoid lifting heavy weights. Maintain proper posture.',
        desese_description: 'Age-related wear and tear of the lower back spine.',
        tags: ['Ortho', 'Spine', 'Back Pain']
      },
      {
        name: 'Plantar Fasciitis',
        symptoms: ['Heel pain', 'Pain with first steps in morning'],
        medicines: [
          { name: 'Ibuprofen', type: 'Tablet', dose: '400 mg', frequency: '1-0-1', route: 'Oral', duration: '5 Days', notes: 'Take with food' }
        ],
        testAdvice: [
          { testName: 'X-Ray Heel (Calcaneus) LAT View', testType: 'Imaging', precautions: '', testDate: 'Immediate' }
        ],
        diet: 'Wear supportive footwear. Use silicone heel cups.',
        desese_description: 'Inflammation of a thick band of tissue that connects the heel bone to the toes.',
        tags: ['Ortho', 'Foot', 'Heel Pain']
      },
      {
        name: 'Frozen Shoulder (Adhesive Capsulitis)',
        symptoms: ['Shoulder stiffness', 'Shoulder pain', 'Decreased range of motion'],
        medicines: [
          { name: 'Aceclofenac + Paracetamol', type: 'Tablet', dose: '1 Tab', frequency: '1-0-1', route: 'Oral', duration: '5 Days', notes: 'For pain and inflammation' },
          { name: 'Methylprednisolone', type: 'Tablet', dose: '4 mg', frequency: '1-0-0', route: 'Oral', duration: '5 Days', notes: 'Steroid, take as prescribed' }
        ],
        testAdvice: [
          { testName: 'X-Ray Shoulder AP View', testType: 'Imaging', precautions: '', testDate: 'Immediate' },
          { testName: 'Blood Sugar (FBS/PPBS)', testType: 'Blood', precautions: 'Fasting required for FBS', testDate: 'Next morning' }
        ],
        diet: 'Diabetic diet if diabetic. Physiotherapy exercises.',
        desese_description: 'Condition characterized by stiffness and pain in your shoulder joint.',
        tags: ['Ortho', 'Shoulder']
      }
    ];

    for (const adv of orthoAdvices) {
      await MedicalAdvice.findOneAndUpdate({ name: adv.name }, adv, { upsert: true, new: true });
    }
    console.log('Ortho Medical Advices seeded successfully!');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
