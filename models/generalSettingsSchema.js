import mongoose from "mongoose";

const generalSettingsSchema = new mongoose.Schema(
  {
    orgName: {
      type: String,
      default: "BioMechaSoft OPD",
      trim: true,
    },
    regNo: {
      type: String,
      default: "",
      trim: true,
    },
    address: {
      type: String,
      default: "Vill - Tarbagan, Po - Dhuliyan, Dist - Murshidabad, Pin - 742202, State - WB",
      trim: true,
    },
    ownerName: {
      type: String,
      default: "",
      trim: true,
    },
    platformFee: {
      type: Number,
      default: 50,
      min: 0,
    },
    googleLocationUrl: {
      type: String,
      default: "",
      trim: true,
    },
    defaultHeaderImage: {
      type: String,
      default: "/Header.jpeg",
    },
    defaultFooterImage: {
      type: String,
      default: "/Footer.png",
    },
    savedAddresses: {
      type: [String],
      default: [
        "Vill - Tarbagan, Po - Dhuliyan, Dist - Murshidabad, Pin - 742202, State - WB",
      ],
    },
    soundSettings: {
      volume: {
        type: Number,
        default: 50,
        min: 0,
        max: 100,
      },
      isMuted: {
        type: Boolean,
        default: false,
      },
    },
    commissionSettings: {
      registeredSelfPercentage: {
        type: Number,
        default: 5,
        min: 0,
        max: 100,
      },
      registeredOtherPercentage: {
        type: Number,
        default: 8,
        min: 0,
        max: 100,
      },
      guestSelfPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      guestOtherPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      defaultPercentage: {
        type: Number,
        default: 5,
        min: 0,
        max: 100,
      },
    },
  },
  { timestamps: true }
);

export const GeneralSettings = mongoose.model("GeneralSettings", generalSettingsSchema);
