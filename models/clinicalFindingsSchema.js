import mongoose from "mongoose";

const clinicalFindingsSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    onExamination: {
      generalCondition: {
        consciousness: {
          status: {
            type: String,
            enum: [
              "alert",
              "conscious",
              "semi_conscious",
              "unconscious",
              "drowsy",
              "confused",
            ],
            default: "alert",
          },
          gcs: {
            eye: { type: Number, min: 1, max: 4, default: 4 },
            verbal: { type: Number, min: 1, max: 5, default: 5 },
            motor: { type: Number, min: 1, max: 6, default: 6 },
            total: { type: Number, default: 15 },
          },
        },
        orientation: {
          time: { type: Boolean, default: true },
          place: { type: Boolean, default: true },
          person: { type: Boolean, default: true },
        },
        behavior: {
          cooperative: { type: Boolean, default: true },
          active: { type: Boolean, default: true },
          agitated: { type: Boolean, default: false },
          irritable: { type: Boolean, default: false },
        },
        appearance: {
          toxicLooking: { type: Boolean, default: false },
          illLooking: { type: Boolean, default: false },
          wellNourished: { type: Boolean, default: true },
          poorlyNourished: { type: Boolean, default: false },
          dehydrated: { type: Boolean, default: false },
        },
      },
      vitalSigns: {
        temperature: {
          value: { type: Number, default: 98.6 },
          unit: { type: String, enum: ["F", "C"], default: "F" },
          fever: { type: Boolean, default: false },
        },
        pulse: {
          rate: { type: Number, default: 78 },
          rhythm: {
            type: String,
            enum: ["regular", "irregular"],
            default: "regular",
          },
          volume: {
            type: String,
            enum: ["normal", "weak", "bounding"],
            default: "normal",
          },
        },
        bloodPressure: {
          systolic: { type: Number, default: 120 },
          diastolic: { type: Number, default: 80 },
          position: {
            type: String,
            enum: ["sitting", "standing", "lying"],
            default: "sitting",
          },
        },
        respiratoryRate: { type: Number, default: 18 },
        spo2: {
          value: { type: Number, min: 0, max: 100, default: 98 },
          onRoomAir: { type: Boolean, default: true },
        },
      },
      systemicSigns: {
        pallor: {
          status: {
            type: String,
            enum: ["present", "absent"],
            default: "absent",
          },
          severity: String,
        },
        icterus: {
          status: {
            type: String,
            enum: ["present", "absent"],
            default: "absent",
          },
          severity: String,
        },
        cyanosis: {
          status: {
            type: String,
            enum: ["present", "absent"],
            default: "absent",
          },
          type: String,
        },
        clubbing: {
          status: {
            type: String,
            enum: ["present", "absent"],
            default: "absent",
          },
          grade: Number,
        },
        edema: {
          status: {
            type: String,
            enum: ["present", "absent"],
            default: "absent",
          },
          type: String,
          pitting: Boolean,
          distribution: String,
        },
        lymphNodes: {
          palpable: { type: Boolean, default: false },
          sites: [String],
          tender: { type: Boolean, default: false },
          consistency: String,
          mobility: String,
        },
      },
      respiratorySystem: {
        inspection: {
          chestShape: {
            type: String,
            enum: ["normal", "pigeon_chest", "funnel_chest", "barrel_chest"],
            default: "normal",
          },
          symmetry: { type: Boolean, default: true },
          useOfAccessoryMuscles: { type: Boolean, default: false },
        },
        palpation: {
          trachea: {
            type: String,
            enum: ["central", "deviated_right", "deviated_left"],
            default: "central",
          },
          chestExpansion: {
            type: String,
            enum: ["equal", "reduced_left", "reduced_right"],
            default: "equal",
          },
        },
        percussion: {
          note: {
            type: String,
            enum: ["resonant", "dull", "hyperresonant"],
            default: "resonant",
          },
        },
        auscultation: {
          breathSounds: {
            type: String,
            enum: ["bilateral_vesicular", "diminished", "absent"],
            default: "bilateral_vesicular",
          },
          addedSounds: {
            wheeze: { type: Boolean, default: false },
            crepitations: { type: Boolean, default: false },
            rhonchi: { type: Boolean, default: false },
            stridor: { type: Boolean, default: false },
          },
        },
      },
      cardiovascularSystem: {
        inspection: {
          precordialBulge: { type: Boolean, default: false },
          visiblePulsations: { type: Boolean, default: false },
        },
        palpation: {
          apexBeat: {
            location: { type: String, default: "5th intercostal space" },
            side: { type: String, enum: ["left", "right"], default: "left" },
            character: {
              type: String,
              enum: ["normal", "hyperdynamic", "weak"],
              default: "normal",
            },
          },
          thrill: { type: Boolean, default: false },
        },
        auscultation: {
          heartSounds: {
            s1: {
              type: String,
              enum: ["normal", "split", "absent"],
              default: "normal",
            },
            s2: {
              type: String,
              enum: ["normal", "split", "absent"],
              default: "normal",
            },
            s3: {
              type: String,
              enum: ["present", "absent"],
              default: "absent",
            },
            s4: {
              type: String,
              enum: ["present", "absent"],
              default: "absent",
            },
          },
          murmur: {
            present: { type: Boolean, default: false },
            timing: String,
            grade: Number,
            radiation: String,
          },
        },
      },
      perAbdomen: {
        inspection: {
          shape: {
            type: String,
            enum: ["normal", "scaphoid", "distended"],
            default: "normal",
          },
          distension: { type: Boolean, default: false },
          visibleVeins: { type: Boolean, default: false },
          umbilicus: {
            type: String,
            enum: ["central", "everted", "inverted"],
            default: "central",
          },
        },
        palpation: {
          soft: { type: Boolean, default: true },
          tenderness: {
            present: { type: Boolean, default: false },
            regions: [String],
          },
          guarding: { type: Boolean, default: false },
          rigidity: { type: Boolean, default: false },
        },
        organomegaly: {
          liver: {
            palpable: { type: Boolean, default: false },
            spanCm: Number,
          },
          spleen: {
            palpable: { type: Boolean, default: false },
            grade: Number,
          },
          kidneys: {
            type: String,
            enum: ["not_palpable", "palpable_left", "palpable_right", "both_palpable"],
            default: "not_palpable",
          },
        },
        bowelSounds: {
          type: String,
          enum: ["normal", "increased", "decreased", "absent"],
          default: "normal",
        },
        freeFluid: { type: Boolean, default: false },
      },
      centralNervousSystem: {
        higherMentalFunctions: {
          speech: {
            type: String,
            enum: ["normal", "slurred", "dysphonia"],
            default: "normal",
          },
          memory: {
            type: String,
            enum: ["intact", "impaired"],
            default: "intact",
          },
        },
        cranialNerves: {
          type: String,
          enum: ["grossly_intact", "abnormal"],
          default: "grossly_intact",
        },
        motorSystem: {
          tone: {
            type: String,
            enum: ["normal", "increased", "decreased"],
            default: "normal",
          },
          power: {
            type: String,
            enum: ["5/5", "4/5", "3/5", "2/5", "1/5", "0/5"],
            default: "5/5",
          },
          reflexes: {
            type: String,
            enum: ["normal", "brisk", "diminished", "absent"],
            default: "normal",
          },
        },
        sensorySystem: {
          type: String,
          enum: ["intact", "impaired"],
          default: "intact",
        },
        coordination: {
          type: String,
          enum: ["normal", "ataxic"],
          default: "normal",
        },
        gait: {
          type: String,
          enum: ["normal", "ataxic", "antalgic"],
          default: "normal",
        },
      },
      musculoskeletalSystem: {
        jointSwelling: { type: Boolean, default: false },
        jointTenderness: { type: Boolean, default: false },
        rangeOfMotion: {
          type: String,
          enum: ["full", "limited"],
          default: "full",
        },
        deformity: { type: Boolean, default: false },
      },
      skin: {
        rash: { type: Boolean, default: false },
        lesions: [String],
        ulcers: { type: Boolean, default: false },
        temperature: {
          type: String,
          enum: ["normal", "hot", "cold"],
          default: "normal",
        },
      },
    },
    notes: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model("ClinicalFindings", clinicalFindingsSchema);
