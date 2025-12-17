// 重新导出 ApiService 方法，保持向后兼容
import { apiService } from "./api-service";

// 认证相关
export const sendVerificationCode = apiService.sendVerificationCode.bind(apiService);
export const loginWithCode = apiService.login.bind(apiService);
export const getCurrentUser = apiService.getCurrentUser.bind(apiService);

// 用户相关
export const uploadFile = apiService.uploadFile.bind(apiService);
export const updateUserProfile = apiService.updateUserProfile.bind(apiService);

// 角色相关
export const createCharacter = apiService.createCharacter.bind(apiService);
export const getMarketCharacters = apiService.getMarketCharacters.bind(apiService);
export const getCharacterById = apiService.getCharacterById.bind(apiService);
export const getUserCharacters = apiService.getUserCharacters.bind(apiService);
export const updateCharacter = apiService.updateCharacter.bind(apiService);
export const deleteCharacter = apiService.deleteCharacter.bind(apiService);

// 聊天相关
export const sendChatMessage = apiService.sendChatMessage.bind(apiService);

// 记忆相关
export const manageMemories = apiService.manageMemories.bind(apiService);
export const searchMemories = apiService.searchMemories.bind(apiService);

// 导出类型和错误类
export * from "./token-store";
export type {
  User,
  AuthResponse,
  ChatMessage,
  ChatRequest,
  MemoryManageRequest,
  MemorySearchRequest,
  UpdateProfileRequest,
  CreateCharacterRequest,
  CharacterResponse,
  UpdateCharacterRequest,
  CharacterVisibility,
} from "./api-service";
