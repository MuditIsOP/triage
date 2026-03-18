import {
  DataSource,
  InjurySeverity,
  LlmStatus,
  PatientStatus,
  Priority,
  RiskFlag,
  SymptomInputMode,
} from "@er-triage/shared";
import { Schema, model, type InferSchemaType } from "mongoose";

const vitalsFieldSchema = new Schema(
  {
    value: {
      type: Number,
      default: null,
    },
    dataSource: {
      type: String,
      enum: Object.values(DataSource),
      default: DataSource.Manual,
      alias: "data_source",
    },
  },
  { _id: false },
);

const vitalsHistorySchema = new Schema(
  {
    recordedAt: {
      type: Date,
      default: Date.now,
    },
    source: {
      type: String,
      enum: ["manual", "simulation", "system"],
      default: "system",
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    priority: {
      type: String,
      enum: Object.values(Priority),
      default: Priority.Normal,
    },
    heartRate: {
      type: Number,
      default: null,
    },
    bloodPressureSystolic: {
      type: Number,
      default: null,
    },
    bloodPressureDiastolic: {
      type: Number,
      default: null,
    },
    temperature: {
      type: Number,
      default: null,
    },
    oxygenSaturation: {
      type: Number,
      default: null,
    },
    bloodSugar: {
      type: Number,
      default: null,
    },
  },
  { _id: false },
);

const patientSchema = new Schema(
  {
    sequenceNumber: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    patientId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: Number,
      required: true,
      min: 0,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: true,
    },
    symptoms: {
      controlled: {
        type: [String],
        default: [],
      },
      otherText: {
        type: String,
        default: "",
      },
      inputMode: {
        type: String,
        enum: Object.values(SymptomInputMode),
        default: SymptomInputMode.Controlled,
      },
      normalizedSymptoms: {
        type: [String],
        default: [],
      },
      llmOriginalNormalizedSymptoms: {
        type: [String],
        default: [],
      },
      nurseConfirmedSymptoms: {
        type: Boolean,
        default: false,
      },
    },
    vitals: {
      heartRate: {
        type: vitalsFieldSchema,
        default: () => ({}),
      },
      bloodPressureSystolic: {
        type: vitalsFieldSchema,
        default: () => ({}),
      },
      bloodPressureDiastolic: {
        type: vitalsFieldSchema,
        default: () => ({}),
      },
      temperature: {
        type: vitalsFieldSchema,
        default: () => ({}),
      },
      oxygenSaturation: {
        type: vitalsFieldSchema,
        default: () => ({}),
      },
      bloodSugar: {
        type: vitalsFieldSchema,
        default: () => ({}),
      },
    },
    injuryIncident: {
      type: {
        type: String,
        default: "",
      },
      severity: {
        type: String,
        enum: [...Object.values(InjurySeverity), null],
        default: null,
      },
      bleeding: {
        type: Boolean,
        default: false,
      },
      unconsciousReported: {
        type: Boolean,
        default: false,
      },
    },
    history: {
      diabetes: {
        type: Boolean,
        default: false,
      },
      hypertension: {
        type: Boolean,
        default: false,
      },
      heartDisease: {
        type: Boolean,
        default: false,
      },
      other: {
        type: String,
        default: "",
      },
    },
    ai: {
      riskFlags: {
        type: [String],
        enum: Object.values(RiskFlag),
        default: [],
      },
      criticalRiskConfidence: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      summary: {
        type: String,
        default: "",
      },
      llmStatus: {
        type: String,
        enum: Object.values(LlmStatus),
        default: LlmStatus.Fallback,
        alias: "llm_status",
      },
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    priority: {
      type: String,
      enum: Object.values(Priority),
      default: Priority.Normal,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(PatientStatus),
      default: PatientStatus.Waiting,
      index: true,
    },
    bedAssignment: {
      bedId: {
        type: String,
        default: null,
      },
      bedType: {
        type: String,
        enum: ["general", "critical", null],
        default: null,
      },
      priorityMismatch: {
        type: Boolean,
        default: false,
      },
    },
    bedReallocation: {
      state: {
        type: String,
        enum: ["none", "reassigned", "transferring"],
        default: "none",
      },
      message: {
        type: String,
        default: "",
      },
      displacedByPatientId: {
        type: String,
        default: null,
      },
      updatedAt: {
        type: Date,
        default: null,
      },
    },
    doctorNotes: {
      type: String,
      default: "",
    },
    overrideFlag: {
      type: Boolean,
      default: false,
      alias: "override_flag",
    },
    overrideScope: {
      type: String,
      default: "",
      alias: "override_scope",
    },
    doctorOverride: {
      isActive: {
        type: Boolean,
        default: false,
      },
      priority: {
        type: String,
        enum: [...Object.values(Priority), null],
        default: null,
      },
      scope: {
        type: String,
        default: "",
      },
      appliedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      appliedAt: {
        type: Date,
        default: null,
      },
      clearedAt: {
        type: Date,
        default: null,
      },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      alias: "created_by",
    },
    waitingTimeMinutes: {
      type: Number,
      default: 0,
      min: 0,
      alias: "waiting_time",
    },
    lastModifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastModifiedAt: {
      type: Date,
      default: null,
    },
    manualReviewRequired: {
      type: Boolean,
      default: false,
    },
    duplicateConfirmed: {
      type: Boolean,
      default: false,
    },
    awaitingFullData: {
      type: Boolean,
      default: false,
    },
    isDemo: {
      type: Boolean,
      default: false,
      index: true,
    },
    vitalsHistory: {
      type: [vitalsHistorySchema],
      default: [],
    },
    explanation: {
      topFactor: {
        type: String,
        default: "",
      },
      contributors: {
        type: [String],
        default: [],
      },
    },
    referral: {
      destination: {
        type: String,
        default: "",
      },
      reason: {
        type: String,
        default: "",
      },
    },
    version: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

patientSchema.pre("validate", function syncOverrideFields(next) {
  if (!this.doctorOverride) {
    this.doctorOverride = {
      isActive: false,
      priority: null,
      scope: "",
      appliedBy: null,
      appliedAt: null,
      clearedAt: null,
    };
  }

  if (typeof this.overrideFlag === "boolean") {
    this.doctorOverride.isActive = this.overrideFlag;
  } else {
    this.overrideFlag = this.doctorOverride?.isActive ?? false;
  }

  if (typeof this.overrideScope === "string" && this.overrideScope.length > 0) {
    this.doctorOverride.scope = this.overrideScope;
  } else {
    this.overrideScope = this.doctorOverride?.scope ?? "";
  }

  next();
});

export type PatientDocument = InferSchemaType<typeof patientSchema>;

export const PatientModel = model<PatientDocument>("Patient", patientSchema);
