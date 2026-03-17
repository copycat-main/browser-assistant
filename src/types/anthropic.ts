export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: AnthropicContent[];
}

export type AnthropicContent =
  | AnthropicTextBlock
  | AnthropicImageBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

export interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

export interface AnthropicImageBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/png' | 'image/jpeg';
    data: string;
  };
  cache_control?: { type: 'ephemeral' };
}

export interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: ComputerAction;
}

export interface AnthropicToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: AnthropicContent[];
  is_error?: boolean;
}

export type ComputerAction =
  | { action: 'screenshot' }
  | { action: 'left_click'; coordinate: [number, number] }
  | { action: 'right_click'; coordinate: [number, number] }
  | { action: 'double_click'; coordinate: [number, number] }
  | { action: 'middle_click'; coordinate: [number, number] }
  | { action: 'triple_click'; coordinate: [number, number] }
  | { action: 'type'; text: string }
  | { action: 'key'; text: string }
  | { action: 'scroll'; coordinate: [number, number]; delta_x: number; delta_y: number }
  | { action: 'wait' }
  | { action: 'mouse_move'; coordinate: [number, number] }
  | { action: 'left_click_drag'; start_coordinate: [number, number]; coordinate: [number, number] };

export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContent[];
  model: string;
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AnthropicError {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
}

// SSE stream event types
export interface StreamEventMessageStart {
  type: 'message_start';
  message: { id: string; model: string; role: string };
}

export interface StreamEventContentBlockStart {
  type: 'content_block_start';
  index: number;
  content_block: { type: string; text?: string };
}

export interface StreamEventContentBlockDelta {
  type: 'content_block_delta';
  index: number;
  delta: { type: 'text_delta'; text: string } | { type: 'input_json_delta'; partial_json: string };
}

export interface StreamEventContentBlockStop {
  type: 'content_block_stop';
  index: number;
}

export interface StreamEventMessageDelta {
  type: 'message_delta';
  delta: { stop_reason: string };
  usage: { output_tokens: number };
}

export interface StreamEventMessageStop {
  type: 'message_stop';
}

export type StreamEvent =
  | StreamEventMessageStart
  | StreamEventContentBlockStart
  | StreamEventContentBlockDelta
  | StreamEventContentBlockStop
  | StreamEventMessageDelta
  | StreamEventMessageStop
  | { type: 'ping' };

export const COMPUTER_USE_TOOL = {
  type: 'computer_20250124' as const,
  name: 'computer' as const,
  display_width_px: 1024,
  display_height_px: 768,
};

export const BETA_HEADER = 'computer-use-2025-01-24';
