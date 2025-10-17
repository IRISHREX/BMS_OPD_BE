import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { Appointment } from "../models/appointmentSchema.js";
import { Message } from "../models/messageSchema.js";
import { User } from "../models/userSchema.js";
import { Invoice } from "../models/invoiceSchema.js";

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

  // Determine email default
  const emailToUse = email || `${name.slice(0,4)}.${phone.slice(-2)}@BIOMECHASOFT.com`;
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
    let firstName = name.slice(0, name.indexOf(' '));
    let lastName =name.slice(name.indexOf(' ') + 1) || ' ';
    const patientPassword = password || 'defaultPassword123';
    patient = await User.create({
      firstName,
      lastName,
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

  const appointment = await Appointment.create({
    name,
    email: emailToUse,
    phone,
    nic: nicToUse,
    dob: dobDate,
    age: ageVal,
    gender,
    appointment_date: apptDate,
    followup_date: followup_date,
    department,
    doctor: {
      firstName: chosenDoctor.firstName,
      lastName: chosenDoctor.lastName,
    },
    hasVisited: !!hasVisited,
    address,
    doctorId: doctorIdFinal,
    patientId,
    price: bookingPrice,
    paymentStatus: 'Pending',
    status: 'Pending'
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
    const invoice = await Invoice.create({
      invoiceNumber: genInvoiceNumber,
      appointment: appointment._id,
      patient: patientId,
      doctor: doctorIdFinal,
      items: invoiceItems,
      tax: 0,
      discount: 0,
      issuedAt: new Date(),
      status: 'Unpaid'
    });

    // attach invoice to appointment record
    appointment.invoices = appointment.invoices || [];
    appointment.invoices.push(invoice._id);
    await appointment.save();

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

  res.status(200).json({ success: true, appointment, message: 'Appointment Created!' });
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
    andClauses.push({ $or: [ { name: regex }, { phone: regex }, { email: regex }, { nic: regex } ] });
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

  const updated = await Appointment.findByIdAndUpdate(latest._id, payload, {
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
    appointment = await Appointment.findByIdAndUpdate(id, req.body, {
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
+
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
  await appointment.deleteOne();
  res.status(200).json({
    success: true,
    message: "Appointment Deleted!",
  });
});

// Bulk delete appointments by array of IDs
export const bulkDeleteAppointments = catchAsyncErrors(async (req, res, next) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return next(new ErrorHandler("No appointment IDs provided for bulk delete", 400));
  }
  const result = await Appointment.deleteMany({ _id: { $in: ids } });
  res.status(200).json({ success: true, deletedCount: result.deletedCount, message: "Bulk appointments deleted" });
});

// Delete all appointments for a patient (to be called when deleting patient)
export const deleteAppointmentsByPatientId = catchAsyncErrors(async (req, res, next) => {
  const { patientId } = req.params;
  if (!patientId) {
    return next(new ErrorHandler("No patient ID provided", 400));
  }
  const result = await Appointment.deleteMany({ patientId });
  res.status(200).json({ success: true, deletedCount: result.deletedCount, message: "All appointments for patient deleted" });
});
