import mongoose from "mongoose";

const referralSchema = new mongoose.Schema(
  {
    // Patient Information
    patientId: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "Patient ID is required"],
    },
    patientName: {
      type: String,
      required: [true, "Patient name is required"],
    },
    age: {
      type: Number,
      required: false,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", "Male", "Female", "Other"],
      set: (v) => v.toLowerCase(),
      default: "male",
    },
    abhaId: {
      type: String,
      required: false,
    },
    nic: {
      type: String,
      required: false,
    },

    // Clinical Information
    diagnosis: {
      type: String,
      required: [true, "Diagnosis is required"],
    },
    clinicalNotes: {
      type: String,
      required: [true, "Clinical notes are required"],
    },
    requiredCare: {
      type: String,
      required: false,
    },
    urgency: {
      type: String,
      enum: ["routine", "urgent", "emergency"],
      default: "routine",
    },

    // Hospital & Query Information
    hospitals: [
      {
        hospitalId: {
          type: mongoose.Schema.ObjectId,
          ref: "Hospital",
          required: true,
        },
        hospitalName: {
          type: String,
        },
        location: {
          type: String,
        },
        specialty: {
          type: [String],
          default: [],
        },
        beds: {
          type: Number,
        },
        icu: {
          type: Number,
        },
        rating: {
          type: Number,
        },
        nabh: {
          type: Boolean,
        },
      },
    ],

    // Query Parameters
    queryParams: {
      bedType: {
        type: String,
        enum: ["general", "semi-private", "private", "icu"],
        default: "general",
      },
      icuType: {
        type: String,
        default: "",
        validate: {
          validator: function(v) {
            return v === "" || ["micu", "sicu", "picu", "nicu"].includes(v);
          },
          message: 'icuType must be one of: micu, sicu, picu, nicu, or empty'
        }
      },
      otRequired: {
        type: Boolean,
        default: false,
      },
      services: {
        type: [String],
        default: [],
      },
      estimatedCost: {
        type: Number,
        required: false,
      },
      estimatedDays: {
        type: Number,
        default: 3,
      },
    },

    // Attachments
    attachments: [
      {
        fileName: {
          type: String,
        },
        fileUrl: {
          type: String,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Status & Tracking
    status: {
      type: String,
      enum: ["submitted", "under-review", "accepted", "scheduled", "rejected", "completed"],
      default: "submitted",
    },

    referralNumber: {
      type: String,
      unique: true,
      sparse: true,
    },

    referredBy: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },

    referredByName: {
      type: String,
      required: false,
    },

    referredBySpecialty: {
      type: String,
      required: false,
    },

    // Hospital Response
    acceptedHospitalId: {
      type: mongoose.Schema.ObjectId,
      ref: "Hospital",
      required: false,
    },

    acceptedAt: {
      type: Date,
      required: false,
    },

    scheduledDate: {
      type: Date,
      required: false,
    },

    admissionDate: {
      type: Date,
      required: false,
    },

    dischargeDate: {
      type: Date,
      required: false,
    },

    notes: {
      type: String,
      required: false,
    },

    rejectionReason: {
      type: String,
      required: false,
    },

    priorityScore: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Generate referral number before saving
referralSchema.pre("save", async function (next) {
  if (!this.referralNumber) {
    const count = await mongoose.model("Referral").countDocuments();
    this.referralNumber = `REF-${Date.now()}-${count + 1}`;
  }
  next();
});

// Index for search and filtering
referralSchema.index({ patientId: 1, status: 1 });
referralSchema.index({ "hospitals.hospitalId": 1 });
referralSchema.index({ referredBy: 1 });
referralSchema.index({ referralNumber: 1 });
referralSchema.index({ status: 1, urgency: 1 });
referralSchema.index({ createdAt: -1 });

export const Referral = mongoose.model("Referral", referralSchema);
