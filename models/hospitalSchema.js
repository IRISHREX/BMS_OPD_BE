import mongoose from "mongoose";

const hospitalSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Hospital name is required"],
      trim: true,
      minlength: [3, "Hospital name must be at least 3 characters"],
    },
    address: {
      type: String,
      required: [true, "Hospital address is required"],
      trim: true,
    },
    city: {
      type: String,
      required: false,
    },
    state: {
      type: String,
      required: false,
    },
    zipCode: {
      type: String,
      required: false,
    },
    phone: {
      type: String,
      required: false,
    },
    email: {
      type: String,
      required: false,
    },
    website: {
      type: String,
      required: false,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    active: {
      type: Boolean,
      default: true,
    },
    blocked: {
      type: Boolean,
      default: false,
    },
    features: {
      capacity: {
        type: Number,
        default: 0,
      },
      specialty: {
        type: [String],
        default: [],
      },
      bedCount: {
        type: Number,
        default: 0,
      },
      icuBedCount: {
        type: Number,
        default: 0,
      },
      ipd: {
        type: Boolean,
        default: false,
      },
      opd: {
        type: Boolean,
        default: false,
      },
      emergency: {
        type: Boolean,
        default: false,
      },
      nabh: {
        type: Boolean,
        default: false,
      },
      services: {
        type: [String],
        default: [],
      },
      doctors: [
        {
          name: {
            type: String,
            required: false,
          },
          specialty: {
            type: String,
            required: false,
          },
          experience: {
            type: Number,
            required: false,
          },
          referrer: {
            type: Boolean,
            default: false,
          },
          qualification: {
            type: String,
            required: false,
          },
          contact: {
            type: String,
            required: false,
          },
        },
      ],
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Index for search functionality
hospitalSchema.index({ name: "text", address: "text", city: "text" });
hospitalSchema.index({ active: 1, blocked: 1 });

export const Hospital = mongoose.model("Hospital", hospitalSchema);
