/**
 * Export all Sequelize models
 */

import 'reflect-metadata'; // MUST be first for model decorators

export { User } from './user.model';
export { Session } from './session.model';
export { ChatConversation } from './chatConversation.model';
export { ChatMessage } from './chatMessage.model';
export { AgentSession } from './agentSession.model';
export { AgentIteration } from './agentIteration.model';
export { TestingSession } from './testingSession.model';
export { TestingFix } from './testingFix.model';
export { DebugLog } from './debugLog.model';
export { UsageStat } from './usageStat.model';
export { VsixDownload } from './vsixDownload.model';

// Export all models as an array for Sequelize initialization
import { User } from './user.model';
import { Session } from './session.model';
import { ChatConversation } from './chatConversation.model';
import { ChatMessage } from './chatMessage.model';
import { AgentSession } from './agentSession.model';
import { AgentIteration } from './agentIteration.model';
import { TestingSession } from './testingSession.model';
import { TestingFix } from './testingFix.model';
import { DebugLog } from './debugLog.model';
import { UsageStat } from './usageStat.model';
import { VsixDownload } from './vsixDownload.model';

export const models = [
    User,
    Session,
    ChatConversation,
    ChatMessage,
    AgentSession,
    AgentIteration,
    TestingSession,
    TestingFix,
    DebugLog,
    UsageStat,
    VsixDownload
];

export default models;

