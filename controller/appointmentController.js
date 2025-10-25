import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Appointment } from "../models/appointmentSchema.js";
import { Message } from "../models/messageSchema.js";
import { User } from "../models/userSchema.js";
import { Invoice } from "../models/invoiceSchema.js";
import { Report } from "../models/reportSchema.js";

// Helper to centralize business rules for status <-> paymentStatus
// contexts: 'create', 'prescription_save', 'status_update'
function harmonizeStatusPayment({ incomingPayload = {}, existingAppointment = {}, context = 'status_update' }) {
  const payload = { ...incomingPayload };
  const existing = existingAppointment || {};

  // Normalize some values
  if (payload.paymentStatus) payload.paymentStatus = String(payload.paymentStatus);
  if (payload.status) payload.status = String(payload.status);

  if (context === 'create') {
    // At creation, Paid -> Accepted (do NOT auto-complete)
    if (payload.paymentStatus === 'Paid') {
      payload.status = payload.status || 'Accepted';
    // } else if (payload.paymentStatus === 'Accepted') {
    //   payload.status = payload.status || 'Accepted';
    // 
    } else {
      payload.status = payload.status || 'Pending';
    }
    // Do not allow Completed on creation unless explicitly Paid and requested (rare): enforce Paid requirement
    if (payload.status === 'Completed' && payload.paymentStatus !== 'Paid') {
      payload.status = 'Accepted';
      payload.paymentStatus = payload.paymentStatus || 'Due';
    }
    return payload;
  }

  if (context === 'prescription_save') {
    // When saving/printing a prescription, client may request status Completed.
    // Rule: If the appointment is Paid (existing or incoming), then mark Completed.
    // Otherwise mark Accepted and set paymentStatus to Due.
    const wantsComplete = payload.status === 'Completed' || payload.printed === true || payload.print === true || payload.printAndSave === true;
    if (wantsComplete) {
      // Treat legacy 'Accepted' as paid-equivalent for completion checks (backwards compat)
      const isPaid = ['Paid', 'Accepted'].includes(String(payload.paymentStatus || '').trim()) || ['Paid', 'Accepted'].includes(String(existing.paymentStatus || '').trim());
      if (isPaid) {
        payload.status = 'Completed';
        payload.paymentStatus = 'Paid';
      } else {
        payload.status = 'Accepted';
        payload.paymentStatus = 'Pending';
      }
      return payload;
    }

    // If not completing, ensure paymentStatus changes don't incorrectly set Completed
    if (typeof payload.paymentStatus !== 'undefined') {
      // When frontend toggles paymentStatus, accept both 'Paid' and legacy 'Accepted' values
      if (['Paid', 'Accepted'].includes(String(payload.paymentStatus).trim())) payload.status = payload.status || 'Accepted';
    }
    return payload;
  }

  // status_update (generic status changes via dashboard/API)
  if (context === 'status_update') {
    if (typeof payload.paymentStatus !== 'undefined') {
      // Changing payment to Paid should not auto-complete; it should set at least Accepted.
      if (payload.paymentStatus === 'Paid') {
        payload.status = payload.status || 'Accepted';
      } else if (payload.paymentStatus === 'Accepted' || payload.paymentStatus === 'Pending' || payload.paymentStatus === 'Due') {
        payload.status = payload.status || 'Accepted';
      }
    }

    // If client explicitly requests Completed, ensure payment is Paid (existing or incoming)
    if (payload.status === 'Completed') {
      const isPaid = ['Paid', 'Accepted'].includes(String(payload.paymentStatus || '').trim()) || ['Paid', 'Accepted'].includes(String(existing.paymentStatus || '').trim());
      if (!isPaid) {
        payload.status = 'Accepted';
        payload.paymentStatus = payload.paymentStatus || 'Due';
      } else {
        payload.paymentStatus = 'Paid';
      }
    }

    return payload;
  }

  return payload;
}

// Helper to upsert a per-appointment report entry. Keeps logic local to avoid circular imports.
export async function syncReportForAppointment(apptId) {
  if (!apptId) return null;
  const appt = await Appointment.findById(apptId).populate('doctorId').populate('patientId');
  if (!appt) return null;
  // Aggregate amount and paid from all linked invoices; fall back to appointment.price when none
  let amount = Number(appt.price || 0);
  let totalPaidFromInvoices = 0;
  if (appt.invoices && appt.invoices.length > 0) {
    try {
      const invoices = await Invoice.find({ _id: { $in: appt.invoices } });
      if (invoices && invoices.length > 0) {
        // Sum totals from all invoices (prefer invoice.total, fallback to subtotal)
        amount = invoices.reduce((s, inv) => s + (Number(inv.total || inv.subtotal || 0)), 0);
        // Sum payments across invoices
        totalPaidFromInvoices = invoices.reduce((s, inv) => s + ((inv.payments || []).reduce((ps, p) => ps + (Number(p.amount) || 0), 0)), 0);
      }
    } catch (e) {
      // ignore and fallback
      console.error("Error fetching invoices for report aggregation:", e);
    }
  }
  // Determine paid/due using invoice payments when available, otherwise fall back to appointment.paymentStatus
  let paid = 0;
  let due = 0;
  if (totalPaidFromInvoices > 0) {
    paid = Number(totalPaidFromInvoices || 0);
    due = Math.max(0, Number(amount || 0) - paid);
  } else {
    const ps = String(appt.paymentStatus || '').trim();
    if (appt.status === 'Completed') {
      paid = amount;
      due = 0;
    } else if (appt.status === 'Accepted') {
      paid = 0;
      due = amount;
    } else if (['Paid', 'Accepted'].includes(ps)) {
      paid = amount;
      due = 0;
    } else if (['Pending', 'Due'].includes(ps)) {
      paid = 0;
      due = amount;
    } else {
      paid = 0;
      due = amount;
    }
  }

  const payload = {
    appointmentId: appt._id,
    doctorId: appt.doctorId || null,
    patientId: appt.patientId || null,
    appointmentDate: appt.appointment_date || new Date(),
    amount,
    paid,
    due,
    revenue: paid, // backward compatibility
    status: paid > 0 ? 'Paid' : (due > 0 ? 'Due' : 'Adjusted'),
    notes: `Auto-synced from appointment ${appt._id}`,
  };
  const existing = await Report.findOne({ appointmentId: appt._id });
  if (existing) {
    existing.amount = payload.amount;
    existing.revenue = payload.revenue;
    existing.due = payload.due;
    existing.status = payload.status;
    existing.appointmentDate = payload.appointmentDate;
    existing.notes = payload.notes;
    await existing.save();
    return existing;
  }
  const created = await Report.create(payload);
  return created;
}

export const postAppointment = catchAsyncErrors(async (req, res, next) => {
  const {
    name,
    firstName,
    lastName,
    email,
    phone,
    nic,
    dob,
    gender,
    appointment_date,
    followup_date,
    department,
    doctorId,
    hasVisited,
    address,
    result,
    password
    // optional, for new patient creation
  } = req.body;
  console.log("Appointment Request Body: ", req.body);

  // Prefer requester from authenticated middleware (req.user). Fall back to any user sent in body.
  const requester = req.user || req.body.user;
  const requesterRole = requester?.role || 'Guest';
  if (!['Admin', 'Doctor', 'Compounder'].includes(requesterRole)) {
    return next(new ErrorHandler("Only Admin, Doctor or Compounder can create appointments", 403));
  }
  

  if (!name || !phone || !address || !department) {
    return next(new ErrorHandler("Please Fill Required Fields: name, phone, department, address", 400));
  }

  // Determine appointment_date default
  const apptDate = appointment_date || new Date().toISOString();

  // Determine email default or create a custom mail using firstname and phone
  const emailToUse = email || (firstName && phone ? `${firstName.toLowerCase()}.${phone.slice(-2)}@biomechasoft.com` : null);
  console.log("Using email:", emailToUse);

  // Determine nic/dob/age defaults: if age provided but not dob, compute dob; if dob provided but not age compute age; if nic missing generate from phone
  let dobDate = dob ? new Date(dob) : null;
  let ageVal = req.body.age || null;
  if (!dobDate && ageVal) {
    // compute approximate dob by subtracting age years
    const now = new Date();
    dobDate = new Date(now.getFullYear() - Number(ageVal), now.getMonth(), now.getDate());
  }
  if (!ageVal && dobDate) {
    const diff = Date.now() - dobDate.getTime();
    ageVal = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  }
  let nicToUse = nic;
  if (!nicToUse && phone) {
    // generate simple pseudo-NIC from phone + timestamp slice to reach 13 chars (not secure)
    const base = (phone + Date.now().toString()).replace(/\D/g, '');
    nicToUse = base.slice(0, 13).padEnd(13, '0');
  }

  // Find doctor(s): if doctorId provided use that, else pick first doctor in the department
  let chosenDoctor = null;
  let doctors = [];
  if (doctorId) {
    chosenDoctor = await User.findOne({ _id: doctorId, role: 'Doctor' });
    if (!chosenDoctor) {
      return next(new ErrorHandler('Doctor not found for the provided id', 404));
    }
  } else {
    doctors = await User.find({ role: 'Doctor', doctorDepartment: department });
    if (!doctors || doctors.length === 0) {
      return next(new ErrorHandler('Doctor not found for the selected department', 404));
    }
    if (doctors.length > 1) {
      console.log("Multiple doctors found with same name, selecting the first one by default.", doctors);
    }
    chosenDoctor = doctors[0];
  }
  const doctorIdFinal = chosenDoctor._id;

  // Always create/find patient and set patientId
  let patient = await User.findOne({
    $or: [ { nic: nicToUse }, { email: emailToUse } ],
    role: 'Patient'
  });
  if (!patient) {
    // Robust name parsing: trim, collapse spaces, split into words
    const rawName = (name || '').toString().trim();
    const nameParts = rawName.replace(/\s+/g, ' ').split(' ').filter(Boolean);
    let firstName = '';
    let lastName = '';

    if (nameParts.length === 0) {
      // No name provided: try to derive a reasonable firstName from email or phone
      if (emailToUse) {
        firstName = emailToUse.split('@')[0].slice(0, 20);
      } else if (phone) {
        firstName = `Patient-${phone.slice(-4)}`;
      } else {
        firstName = 'Patient';
      }
      lastName = '';
    } else if (nameParts.length === 1) {
      firstName = nameParts[0];
      lastName = '';
    } else {
      firstName = nameParts[0];
      lastName = nameParts.slice(1).join(' ');
    }

    const patientPassword = password || 'defaultPassword123';
    patient = await User.create({
      firstName,
      lastName,
      name: rawName || `${firstName} ${lastName}`.trim(),
      email: emailToUse?.toLowerCase(),
      phone,
      nic: nicToUse,
      dob: dobDate,
      gender: gender || 'Male',
      password: patientPassword,
      role: 'Patient',
      age: ageVal,
    });
  }
  const patientId = patient._id;

  // price comes from doctor's consultationFee, booking price may be smaller (20% of fee) or specific
  const bookingPrice = Math.round((chosenDoctor?.consultationFee || 100) * 0.2);

  // Use provided paymentStatus if present (frontend may provide), otherwise default Pending
  const incomingPaymentStatus = req.body.paymentStatus || 'Pending';
  // derive appointment status + paymentStatus using helper to enforce rules for creation
  const harmonized = harmonizeStatusPayment({ incomingPayload: { paymentStatus: incomingPaymentStatus, status: req.body.status }, existingAppointment: null, context: 'create' });
  const derivedStatus = harmonized.status;
  const finalPaymentStatus = harmonized.paymentStatus || incomingPaymentStatus;

  const appointment = await Appointment.create({
    name,
    email: emailToUse,
    phone,
    nic: nicToUse,
    dob: dobDate,
    age: ageVal,
    gender,
    result,
    appointment_date: apptDate,
    followup_date: followup_date,
    department,
    doctor: {
      firstName: chosenDoctor.firstName,
      lastName: chosenDoctor.lastName,
    },
    hasVisited: !!hasVisited,
    address,
  booked_by: requester ? requester._id : undefined,
  book_by_name: requester ? `${requester.firstName || ''} ${requester.lastName || ''}`.trim() : (req.body.user ? `${req.body.user.firstName || ''} ${req.body.user.lastName || ''}`.trim() : ''),
    doctorId: doctorIdFinal,
    patientId,
    price: bookingPrice,
    paymentStatus: finalPaymentStatus,
    status: derivedStatus,
  });

  // Auto-generate invoice for this appointment
  try {
    const genInvoiceNumber = `INV-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Date.now().toString().slice(-6)}`;
    // Use doctor's consultationFee when available, otherwise fall back to bookingPrice
    const consultationFee = Number(chosenDoctor?.consultationFee || bookingPrice || 0);
    const platformFee = 50; // default platform fee

    const invoiceItems = [
      { description: 'Consultation Fee', quantity: 1, unitPrice: consultationFee, total: consultationFee },
      { description: 'Platform Fee', quantity: 1, unitPrice: platformFee, total: platformFee },
    ];
console.log("Creating invoice with items:", appointment._id);
    // map legacy 'Accepted' to 'Paid' when creating invoice status
    const normalizedInvoiceStatus = (finalPaymentStatus === 'Paid' || finalPaymentStatus === 'Accepted') ? 'Paid' : 'Unpaid';
    const invoice = await Invoice.create({
      invoiceNumber: genInvoiceNumber,
      appointment: appointment._id,
      patient: patientId,
      doctor: doctorIdFinal,
      items: invoiceItems,
      tax: 0,
      discount: 0,
      issuedAt: new Date(),
      status: normalizedInvoiceStatus,
    });

    // attach invoice to appointment record
    appointment.invoices = appointment.invoices || [];
    appointment.invoices.push(invoice._id);
    await appointment.save();

    // sync report entry for this appointment
    try {
      await syncReportForAppointment(appointment._id);
    } catch (e) {
      console.warn('Failed to sync report after invoice creation:', e.message);
    }

    // If client requested invoice download (query param download=true) return a simple HTML invoice as attachment
    if (req.query && req.query.download === 'true') {
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${invoice.invoiceNumber}</title></head><body><h1>Invoice: ${invoice.invoiceNumber}</h1><p>Patient: ${appointment.name}</p><p>Phone: ${appointment.phone}</p><p>Doctor: ${chosenDoctor.firstName} ${chosenDoctor.lastName}</p><p>Department: ${appointment.department}</p><p>Date: ${appointment.appointment_date}</p><p>Items:</p><ul>${invoice.items.map(i=>`<li>${i.description} - ${i.quantity} x ${i.unitPrice} = ${i.total}</li>`).join('')}</ul><p>Subtotal: ${invoice.subtotal}</p><p>Tax: ${invoice.tax}</p><p>Discount: ${invoice.discount}</p><p>Total: ${invoice.total} Rs</p><p>Payment Status: ${invoice.status}</p></body></html>`;
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice._id}.html"`);
      return res.status(200).send(html);
    }
  } catch (e) {
    console.warn('Failed to create invoice for appointment:', e.message);
    // proceed without failing the appointment creation
  }

  // Return populated appointment (include booked_by and invoices)
  const populatedAppointment = await Appointment.findById(appointment._id).populate('booked_by').populate('invoices');
  res.status(200).json({ success: true, appointment: populatedAppointment, message: 'Appointment Created!' });
});

export const getAllAppointments = catchAsyncErrors(async (req, res, next) => {
  // If requester is a Doctor, limit to appointments where doctorId matches
  const requester = req.user;
  let query = {};
  if (requester && requester.role === 'Doctor') {
    query.doctorId = requester._id;
  }
  const appointments = await Appointment.find(query);
  res.status(200).json({
    success: true,
    appointments,
  });
});

// Get appointments by patient ID
export const getAppointmentsByPatientId = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const requester = req.user;
  const query = { patientId: id };
  if (requester && requester.role === 'Doctor') {
    query.doctorId = requester._id;
  }
  const appointments = await Appointment.find(query);
  if (!appointments || appointments.length === 0) {
    return next(new ErrorHandler("No appointments found for this patient!", 404));
  }
  res.status(200).json({
    success: true,
    appointments,
  });
});

// Search appointments by patient name or phone
export const searchAppointments = catchAsyncErrors(async (req, res, next) => {
  // Supports flexible search: q (search across name, phone, email, nic), optional department, status
  const { q, department, status } = req.query;
  if (!q && !department && !status) {
    return next(new ErrorHandler("Please provide search query or filters", 400));
  }

  const query = {};
  const andClauses = [];

  if (q) {
    const regex = new RegExp(q, 'i');
    andClauses.push({ $or: [ { name: regex }, { firstName: regex }, { lastName: regex }, { phone: regex }, { email: regex }, { nic: regex }, { address: regex } ] });
  }

  if (department) {
    andClauses.push({ department });
  }

  if (status) {
    andClauses.push({ status });
  }

  if (andClauses.length > 0) query.$and = andClauses;

  const appointments = await Appointment.find(query);
  if (!appointments || appointments.length === 0) {
    return next(new ErrorHandler("No appointments found for given search/filters", 404));
  }
  res.status(200).json({ success: true, appointments });
});

// Suggest existing patients for autosuggest during appointment booking
export const suggestPatients = catchAsyncErrors(async (req, res, next) => {
  const { q, limit = 10 } = req.query;
  if (!q || String(q).trim().length === 0) {
    return res.status(200).json({ success: true, patients: [] });
  }
  const regex = new RegExp(q, 'i');
  // search users with role Patient
  const users = await User.find({
    role: 'Patient',
    $or: [ { name: regex }, { firstName: regex }, { lastName: regex }, { phone: regex }, { email: regex }, { nic: regex }, { address: regex } ]
  }).limit(Number(limit)).select('name firstName lastName phone email address nic').lean();

  // Optionally include last appointment date for each patient
  const results = await Promise.all(users.map(async (u) => {
    const lastAppt = await Appointment.findOne({ patientId: u._id }).sort({ appointment_date: -1 }).select('appointment_date department doctorId').lean();
    return {
      _id: u._id,
      name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim(),
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
      email: u.email,
      diagnosys: u.diagnosys || null,
      address: u.address,
      nic: u.nic,
      dob: u.dob || null,
      gender: u.gender || null,
      age: u.age || null,
      lastAppointment: lastAppt ? lastAppt.appointment_date : null,
    };
  }));

  res.status(200).json({ success: true, patients: results });
});

// Update latest appointment for a patient by patient ID
export const updateAppointmentByPatientId = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params; // patient id
  const appointments = await Appointment.find({ patientId: id });
  if (!appointments || appointments.length === 0) {
    return next(new ErrorHandler("No appointments found for this patient!", 404));
  }
  // pick latest by appointment_date
  appointments.sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date));
  const latest = appointments[0];
  // Normalize incoming payload: ensure result is an array and medicineAdvice is an array of normalized objects
  const payload = { ...req.body };
  if (payload.result && Array.isArray(payload.result)) {
    payload.result = payload.result.map((r) => {
      const copy = { ...r };
      // Ensure medicineAdvice is an array
      if (copy.medicineAdvice && !Array.isArray(copy.medicineAdvice)) {
        copy.medicineAdvice = [copy.medicineAdvice];
      }
      if (!copy.medicineAdvice) copy.medicineAdvice = [];

      // Normalize medicine object keys to: name,type,dose,frequency,route,duration
      copy.medicineAdvice = copy.medicineAdvice.map((med) => {
        if (!med || typeof med !== 'object') return med;
        return {
          name: med.name || med.Medicine || med.MedicineName || "",
          type: med.type || med.Type || "",
          dose: med.dose || med.Dose || "",
          frequency: med.frequency || med.Frequency || med.Interval || "",
          route: med.route || med.Rout || med.Route || med.rout || "",
          duration: med.duration || med.Duration || "",
          // keep any extra props if present
          ...med,
        };
      });

      return copy;
    });
  }

  // Ensure payment/status consistency for patient-update route
  // Harmonize status/payment, then merge with the rest of the payload from the request body
  const harmonizedStatusPayment = harmonizeStatusPayment({ incomingPayload: payload, existingAppointment: latest, context: 'prescription_save' });
  const updatePayload = { ...payload, ...harmonizedStatusPayment };

  const updated = await Appointment.findByIdAndUpdate(latest._id, updatePayload, {
    new: true,
    runValidators: true,
    useFindAndModify: false,
  });
  res.status(200).json({ success: true, appointment: updated, message: "Appointment Updated!" });
});

export const updateAppointmentStatus = catchAsyncErrors(
  async (req, res, next) => {
    const { id } = req.params;
    let appointment = await Appointment.findById(id);
    if (!appointment) {
      return next(new ErrorHandler("Appointment not found!", 404));
    }
    const before = await Appointment.findById(id);
    // Harmonize incoming payload according to generic status update rules
    const incoming = { ...req.body };
    const updatePayload = harmonizeStatusPayment({ incomingPayload: incoming, existingAppointment: appointment, context: 'status_update' });

    appointment = await Appointment.findByIdAndUpdate(id, updatePayload, {
      new: true,
      runValidators: true,
      useFindAndModify: false,
    });
    // create a message to notify patient when status changes
    try {
      const prevStatus = before?.status;
      const newStatus = appointment?.status;
      if (prevStatus !== newStatus) {
        const text = `Your appointment scheduled on ${appointment.appointment_date} is now ${newStatus}.`;
        await Message.create({ firstName: appointment.firstName, lastName: appointment.lastName, email: appointment.email, phone: appointment.phone, message: text, sentAt: new Date() });
      }
    } catch (e) {
      console.warn('Failed to create notification message:', e.message);
    }
    // Sync report entry after status/payment update

    // If paymentStatus transitioned to Paid, settle related invoices by creating payments
    try {
      const prevPayment = String(before.paymentStatus || '').trim();
      const newPayment = String(appointment.paymentStatus || '').trim();
      if (prevPayment !== 'Paid' && newPayment === 'Paid') {
        // settle invoices: for each invoice, append payment for remaining due
        try {
          const invoices = await Invoice.find({ appointment: appointment._id });
          for (const inv of invoices) {
            const paid = (inv.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
            const total = Number(inv.total || 0);
            const due = Math.max(0, total - paid);
            if (due > 0) {
              inv.payments = inv.payments || [];
              const p = { paidAt: new Date(), amount: due, method: 'Settlement', reference: 'appointment-paid-change' };
              if (req.user && req.user._id) p.createdBy = req.user._id;
              inv.payments.push(p);
              // recompute status
              const paidNow = (inv.payments || []).reduce((s, p2) => s + (Number(p2.amount) || 0), 0);
              if (paidNow >= Number(inv.total || 0) && Number(inv.total || 0) > 0) inv.status = 'Paid';
              else if (paidNow > 0) inv.status = 'Partial';
              else inv.status = 'Unpaid';
              await inv.save();
            }
          }
        } catch (e) {
          console.warn('Failed to auto-settle invoices after appointment set to Paid:', e.message);
        }
      }

      await syncReportForAppointment(appointment._id);
    } catch (e) {
      console.warn('Failed to sync report after appointment status update:', e.message);
    }

    res.status(200).json({
      success: true,
      message: "Appointment Status Updated!",
      appointment,
    });
  }
);

export const deleteAppointment = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const appointment = await Appointment.findById(id);
  if (!appointment) {
    return next(new ErrorHandler("Appointment Not Found!", 404));
  }
  // delete any invoices linked to this appointment
  try {
    await Invoice.deleteMany({ appointment: appointment._id });
  } catch (e) {
    console.warn('Failed to delete invoices for appointment', appointment._id, e.message);
  }
  // delete persisted report entry for this appointment
  try {
    await Report.deleteMany({ appointmentId: appointment._id });
  } catch (e) {
    console.warn('Failed to delete report entries for appointment', appointment._id, e.message);
  }

  await appointment.deleteOne();
  res.status(200).json({
    success: true,
    message: "Appointment and related invoices/reports deleted!",
  });
});

// Bulk delete appointments by array of IDs
export const bulkDeleteAppointments = catchAsyncErrors(async (req, res, next) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return next(new ErrorHandler("No appointment IDs provided for bulk delete", 400));
  }
  // delete invoices and report entries associated with these appointments
  try {
    await Invoice.deleteMany({ appointment: { $in: ids } });
  } catch (e) {
    console.warn('Failed to delete invoices for bulk appointments', e.message);
  }
  try {
    await Report.deleteMany({ appointmentId: { $in: ids } });
  } catch (e) {
    console.warn('Failed to delete report entries for bulk appointments', e.message);
  }
  const result = await Appointment.deleteMany({ _id: { $in: ids } });
  res.status(200).json({ success: true, deletedCount: result.deletedCount, message: "Bulk appointments and related invoices/reports deleted" });
});

// Delete all appointments for a patient (to be called when deleting patient)
export const deleteAppointmentsByPatientId = catchAsyncErrors(async (req, res, next) => {
  const { patientId } = req.params;
  if (!patientId) {
    return next(new ErrorHandler("No patient ID provided", 400));
  }
  // find appointment ids for this patient to cascade delete invoices/reports
  const appts = await Appointment.find({ patientId }).select('_id');
  const ids = appts.map(a => a._id);
  try {
    if (ids.length > 0) {
      await Invoice.deleteMany({ appointment: { $in: ids } });
      await Report.deleteMany({ appointmentId: { $in: ids } });
    }
  } catch (e) {
    console.warn('Failed to delete invoices/reports for patient appointments', e.message);
  }
  const result = await Appointment.deleteMany({ patientId });
  res.status(200).json({ success: true, deletedCount: result.deletedCount, message: "All appointments and related invoices/reports for patient deleted" });
});
