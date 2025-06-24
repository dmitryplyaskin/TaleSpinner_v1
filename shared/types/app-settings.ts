export interface AppSettings {
  language: "ru" | "en";
  openLastChat: boolean;
  autoSelectCurrentPersona: boolean;
}

export interface AppSettingsResponse {
  settings: AppSettings;
}
