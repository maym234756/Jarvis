import { RISK_LEVELS } from "../policy-engine.js";

export class PreferencesGetTool {
  constructor(preferenceStore) {
    this.name = "preferences.get";
    this.description = "Read active Jarvis user preference records.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.capabilities = ["user-preferences", "personalization", "memory"];
    this.preferenceStore = preferenceStore;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize() {
    return "Read user preferences";
  }

  async run() {
    const preferences = await this.preferenceStore.list();
    return {
      summary: `${preferences.length} active preference(s)`,
      preferences
    };
  }
}

export class PreferencesSetTool {
  constructor(preferenceStore) {
    this.name = "preferences.set";
    this.description = "Save or update a Jarvis user preference with confidence and sensitivity metadata.";
    this.riskLevel = RISK_LEVELS.LOCAL_WRITE;
    this.capabilities = ["user-preferences", "personalization", "memory-write"];
    this.preferenceStore = preferenceStore;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return `Set preference ${args.key}`;
  }

  async run(args) {
    const preference = await this.preferenceStore.set(args);
    return {
      summary: `Saved preference ${preference.key}`,
      preference
    };
  }
}

export class PreferencesGcTool {
  constructor(preferenceStore) {
    this.name = "preferences.gc";
    this.description = "Garbage-collect expired or low-confidence Jarvis preference records.";
    this.riskLevel = RISK_LEVELS.LOCAL_WRITE;
    this.capabilities = ["user-preferences", "memory-gc"];
    this.preferenceStore = preferenceStore;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize() {
    return "Garbage-collect user preferences";
  }

  async run(args = {}) {
    const result = await this.preferenceStore.garbageCollect({
      minConfidence: args.minConfidence ?? 0.2
    });
    return {
      summary: `Removed ${result.removed} preference record(s)`,
      result
    };
  }
}
