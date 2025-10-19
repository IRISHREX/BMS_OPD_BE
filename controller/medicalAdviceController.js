// Get all unique symptoms, names, and medicine names as a single list
export const getAllSuggestions = catchAsyncErrors(async (req, res, next) => {
  // Return both a flat suggestions list (tokens) and structured advice documents
  const advices = await MedicalAdvice.find({}, {
    name: 1,
    symptoms: 1,
    type: 1,
    route: 1,
    dose: 1,
    frequency: 1,
    duration: 1,
    medicines: 1,
    testAdvice: 1,
    medication: 1,
    diet: 1,
    aliases: 1,
    tags: 1,
    followup: 1,
  }).lean();

  let suggestions = [];
  advices.forEach(advice => {
    if (advice.name) suggestions.push(advice.name);
    if (Array.isArray(advice.symptoms)) suggestions.push(...advice.symptoms);
    if (Array.isArray(advice.aliases)) suggestions.push(...advice.aliases);
    if (advice.type) suggestions.push(advice.type);
    if (advice.route) suggestions.push(advice.route);
    if (advice.dose) suggestions.push(advice.dose);
    if (advice.frequency) suggestions.push(advice.frequency);
    if (advice.duration) suggestions.push(advice.duration);
    // also include simple medicine names from nested medicines
    if (Array.isArray(advice.medicines)) {
      advice.medicines.forEach(m => { if (m && m.name) suggestions.push(m.name); });
    }
    // simple test names from nested testAdvice
    if (Array.isArray(advice.testAdvice)) {
      advice.testAdvice.forEach(t => { if (t && t.testName) suggestions.push(t.testName); });
    }
  });

  // Clean up, deduplicate, and sort
  suggestions = Array.from(new Set(suggestions.filter(Boolean).map(s => String(s).trim()))).sort();

  // Return both tokens and structured advices (lean documents)
  res.status(200).json({ success: true, suggestions, advices });
});
import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { MedicalAdvice } from "../models/medicalAdviceSchema.js";
import { Message } from "../models/messageSchema.js";

export const createMedicalAdvice = catchAsyncErrors(async (req, res, next) => {
  const { name, symptoms, type, route, desese_description } = req.body;
  if (!name) return next(new ErrorHandler("Name is required", 400));

  const advice = await MedicalAdvice.create({
    name,
    symptoms: Array.isArray(symptoms) ? symptoms : symptoms ? [symptoms] : [],
    type,
    route,
    desese_description,
  });

  // create an internal message/log for this change
  try { await Message.create({ firstName: 'System', lastName: '', email: 'system@local', phone: '', message: `Medicine added: ${advice.name}`, sentAt: new Date() }); } catch(e){ }

  res.status(201).json({ success: true, advice });
});

export const getAllMedicalAdvice = catchAsyncErrors(async (req, res, next) => {
  // pagination: ?page=1&limit=10
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await MedicalAdvice.countDocuments();
  const advices = await MedicalAdvice.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
  const totalPages = Math.ceil(total / limit) || 0;

  res.status(200).json({ success: true, advices, total, page, totalPages });
});

export const getMedicalAdviceById = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const advice = await MedicalAdvice.findById(id);
  if (!advice) return next(new ErrorHandler("Medical advice not found", 404));
  res.status(200).json({ success: true, advice });
});

export const updateMedicalAdvice = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const payload = { ...req.body };
  if (payload.symptoms && !Array.isArray(payload.symptoms)) {
    payload.symptoms = [payload.symptoms];
  }
  const updated = await MedicalAdvice.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
    useFindAndModify: false,
  });
  if (!updated) return next(new ErrorHandler("Medical advice not found", 404));
  res.status(200).json({ success: true, advice: updated, message: "Updated!" });
});

export const deleteMedicalAdvice = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const advice = await MedicalAdvice.findById(id);
  if (!advice) return next(new ErrorHandler("Medical advice not found", 404));
  await advice.deleteOne();
  try { await Message.create({ firstName: 'System', lastName: '', email: 'system@local', phone: '', message: `Medicine deleted: ${advice.name}`, sentAt: new Date() }); } catch(e){ }
  res.status(200).json({ success: true, message: "Deleted!" });
});

// Search by name, symptom, type, or route. Query params: q (general), name, symptom, type, route
export const searchMedicalAdvice = catchAsyncErrors(async (req, res, next) => {
  const { q, name, symptom, type, route } = req.query;
  const query = {};
  if (q) {
    const regex = new RegExp(q, "i");
    query.$or = [
      { name: regex },
      { desese_description: regex },
      { type: regex },
      { route: regex },
      { symptoms: { $elemMatch: { $regex: regex } } },
    ];
  }
  if (name) query.name = new RegExp(name, "i");
  if (symptom) query.symptoms = { $elemMatch: { $regex: new RegExp(symptom, "i") } };
  if (type) query.type = new RegExp(type, "i");
  if (route) query.route = new RegExp(route, "i");

  // pagination support for search as well
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;
  const total = await MedicalAdvice.countDocuments(query);
  const advices = await MedicalAdvice.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);
  const totalPages = Math.ceil(total / limit) || 0;
  // always return a 200 with results and pagination metadata (empty array if none)
  res.status(200).json({ success: true, advices, total, page, totalPages });
});

// Bulk insert: accepts an array of advice objects in request body
export const bulkCreateMedicalAdvice = catchAsyncErrors(async (req, res, next) => {
  const items = req.body;
  if (!Array.isArray(items) || items.length === 0) return next(new ErrorHandler('Request body must be a non-empty array', 400));

  // Normalize items
  const normalized = items.map(it => ({
    name: it.name || it.Name || "",
    symptoms: Array.isArray(it.symptoms) ? it.symptoms : (it.symptoms ? (typeof it.symptoms === 'string' ? it.symptoms.split(',').map(s=>s.trim()).filter(Boolean) : [it.symptoms]) : []),
    type: it.type || it.Type || "",
    route: it.route || it.Route || "",
    desese_description: it.desese_description || it.desese_description || it.description || it.deseseDescription || "",
  })).filter(i => i.name);

  if (!normalized.length) return next(new ErrorHandler('No valid items to insert', 400));

  // Insert many, continue on errors (ordered: false)
  const result = await MedicalAdvice.insertMany(normalized, { ordered: false });
  res.status(201).json({ success: true, inserted: result.length, result });
});

// Return list of unique symptoms across advices
export const getSymptomsList = catchAsyncErrors(async (req, res, next) => {
  const symptoms = await MedicalAdvice.distinct('symptoms');
  const cleaned = (symptoms || []).filter(Boolean).map(s => String(s).trim()).sort();
  res.status(200).json({ success: true, symptoms: cleaned });
});

// Return list of advices (supports q regex query for typeahead)
export const getAdvicesList = catchAsyncErrors(async (req, res, next) => {
  const q = req.query.q || '';
  const limit = parseInt(req.query.limit, 10) || 50;
  const query = {};
  if (q) {
    const regex = new RegExp(q, 'i');
    query.$or = [
      { name: regex },
      { desese_description: regex },
      { type: regex },
      { route: regex },
      { 'medicines.name': regex },
      { 'testAdvice.testName': regex },
      { symptoms: { $elemMatch: { $regex: regex } } },
    ];
  }
  const advices = await MedicalAdvice.find(query).limit(limit).lean();
  res.status(200).json({ success: true, advices });
});

// Return unique test names
export const getTestsList = catchAsyncErrors(async (req, res, next) => {
  const advices = await MedicalAdvice.find({}, { testAdvice: 1 }).lean();
  const set = new Set();
  advices.forEach(a => {
    if (Array.isArray(a.testAdvice)) a.testAdvice.forEach(t => { if (t && t.testName) set.add(String(t.testName).trim()); });
  });
  const tests = Array.from(set).sort();
  res.status(200).json({ success: true, tests });
});

// regex-based query for autosuggest with scoring by token matches
function scoreAdviceForQuery(adviceObj, q) {
  if (!q) return { score: 0, matches: 0, matchedAll: false };
  const text = ((adviceObj.name || '') + ' ' + (adviceObj.desese_description || '') + ' ' + (adviceObj.type || '') + ' ' + (adviceObj.route || '') + ' ' + (adviceObj.symptoms || []).join(' ')).toLowerCase();
  const tokens = String(q).toLowerCase().split(/\W+/).filter(Boolean);
  let matches = 0;
  tokens.forEach(t => { if (t && text.includes(t)) matches += 1; });
  let symptomBonus = 0;
  if (Array.isArray(adviceObj.symptoms)) {
    const lowerSymptoms = adviceObj.symptoms.map(s => (s || '').toLowerCase());
    tokens.forEach(t => { if (lowerSymptoms.some(s => s.includes(t))) symptomBonus += 1; });
  }
  const exactName = (adviceObj.name || '').toLowerCase() === tokens.join(' ');
  let score = matches + symptomBonus;
  if (exactName) score += 2;
  const matchedAll = matches === tokens.length && tokens.length > 0;
  if (matchedAll) score += 2;
  return { score, matches, matchedAll };
}

export const suggestQuery = catchAsyncErrors(async (req, res, next) => {
  const q = req.query.q || '';
  const limit = parseInt(req.query.limit, 10) || 12;
  // basic query to narrow down set
  const query = {};
  if (q) {
    const regex = new RegExp(q, 'i');
    query.$or = [
      { name: regex },
      { desese_description: regex },
      { 'medicines.name': regex },
      { 'testAdvice.testName': regex },
      { symptoms: { $elemMatch: { $regex: regex } } },
    ];
  }
  const advices = await MedicalAdvice.find(query).limit(200).lean();
  // score and sort
  const scored = advices.map(a => ({ ...a, _scoreData: scoreAdviceForQuery(a, q) }));
  scored.sort((x, y) => {
    if (x._scoreData.matchedAll && !y._scoreData.matchedAll) return -1;
    if (!x._scoreData.matchedAll && y._scoreData.matchedAll) return 1;
    return (y._scoreData.score || 0) - (x._scoreData.score || 0);
  });
  const top = scored.slice(0, limit).map(s => ({ ...s, _score: s._scoreData.score, _matches: s._scoreData.matches, _matchedAll: s._scoreData.matchedAll }));
  res.status(200).json({ success: true, advices: top, total: top.length });
});

// Analyze selected symptoms to propose aggregated suggestions
export const analyzeSymptoms = catchAsyncErrors(async (req, res, next) => {
  const input = req.body || {};
  const symptoms = Array.isArray(input.symptoms) ? input.symptoms.map(s => String(s).toLowerCase().trim()).filter(Boolean) : [];
  if (!symptoms.length) return res.status(200).json({ success: true, suggested: { medicines: [], testAdvice: [], medication: '', diet: '' }, matches: [] });
  // find advices which have any of these symptoms
  const advices = await MedicalAdvice.find({ symptoms: { $in: symptoms } }).lean();
  // Count matches per advice
  const scored = advices.map(a => {
    const aSymptoms = (a.symptoms || []).map(s => (s || '').toLowerCase());
    const matched = symptoms.filter(s => aSymptoms.some(as => as.includes(s)));
    return { advice: a, matchedCount: matched.length, matchedSymptoms: Array.from(new Set(matched)) };
  });
  scored.sort((x, y) => y.matchedCount - x.matchedCount);
  // take top advices (those with max matchedCount)
  const maxCount = scored.length ? scored[0].matchedCount : 0;
  const top = scored.filter(s => s.matchedCount === maxCount && maxCount > 0).map(s => s.advice);
  // aggregate medicines, tests, medication, diet
  const medMap = new Map();
  const testMap = new Map();
  const medsText = [];
  let dietText = '';
  top.forEach(a => {
    if (Array.isArray(a.medicines)) a.medicines.forEach(m => { if (m && m.name) medMap.set(m.name, m); });
    if (Array.isArray(a.testAdvice)) a.testAdvice.forEach(t => { if (t && t.testName) testMap.set(t.testName, t); });
    if (a.medication) medsText.push(a.medication);
    if (a.diet) dietText = dietText ? dietText + '\n' + a.diet : a.diet;
  });
  const suggested = {
    medicines: Array.from(medMap.values()),
    testAdvice: Array.from(testMap.values()),
    medication: medsText.join('\n'),
    diet: dietText,
  };
  res.status(200).json({ success: true, matches: scored, suggested, topCount: top.length });
});
