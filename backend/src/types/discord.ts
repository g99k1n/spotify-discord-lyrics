export interface CustomStatusPayload {
  text: string;
  emojiName?: string;
}

export interface DiscordStatusResult {
  success: boolean;
  throttled?: boolean;
  error?: string;
  cleared?: boolean;
}
