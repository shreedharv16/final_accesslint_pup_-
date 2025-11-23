-- ============================================================================
-- AccessLint PostgreSQL Database Schema
-- Version: 1.0.0
-- Description: Complete database schema for AccessLint backend
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    rate_limit_per_hour INTEGER DEFAULT 100,
    rate_limit_tokens_per_day INTEGER DEFAULT 100000,
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at);

COMMENT ON TABLE users IS 'User accounts and authentication';
COMMENT ON COLUMN users.rate_limit_per_hour IS 'Number of API requests allowed per hour';
COMMENT ON COLUMN users.rate_limit_tokens_per_day IS 'Number of AI tokens allowed per day';

-- ============================================================================
-- SESSION MANAGEMENT
-- ============================================================================

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token VARCHAR(500) NOT NULL,
    refresh_token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_access_token ON sessions(access_token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_created_at ON sessions(created_at);

COMMENT ON TABLE sessions IS 'Active user sessions with JWT tokens';

-- ============================================================================
-- CHAT SYSTEM
-- ============================================================================

CREATE TABLE chat_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_archived BOOLEAN DEFAULT FALSE,
    CONSTRAINT valid_conversation_type CHECK (conversation_type IN ('quick_mode', 'agent_mode'))
);

CREATE INDEX idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX idx_chat_conversations_type ON chat_conversations(conversation_type);
CREATE INDEX idx_chat_conversations_updated_at ON chat_conversations(updated_at);

COMMENT ON TABLE chat_conversations IS 'Chat conversation sessions';
COMMENT ON COLUMN chat_conversations.conversation_type IS 'Type: quick_mode or agent_mode';

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    tool_calls JSONB,
    tokens_used INTEGER DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_role CHECK (role IN ('user', 'assistant', 'system'))
);

CREATE INDEX idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_timestamp ON chat_messages(timestamp);
CREATE INDEX idx_chat_messages_role ON chat_messages(role);

COMMENT ON TABLE chat_messages IS 'Individual messages in chat conversations';
COMMENT ON COLUMN chat_messages.tool_calls IS 'JSON array of tool calls executed';

-- ============================================================================
-- AGENT EXECUTION (Chat Agent & Testing Agent)
-- ============================================================================

CREATE TABLE agent_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_type VARCHAR(50) NOT NULL,
    goal TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    total_iterations INTEGER DEFAULT 0,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    file_changes JSONB,
    completion_summary TEXT,
    error_message TEXT,
    CONSTRAINT valid_session_type CHECK (session_type IN ('chat_agent', 'testing_agent')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'completed', 'error', 'timeout'))
);

CREATE INDEX idx_agent_sessions_user_id ON agent_sessions(user_id);
CREATE INDEX idx_agent_sessions_type ON agent_sessions(session_type);
CREATE INDEX idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX idx_agent_sessions_start_time ON agent_sessions(start_time);

COMMENT ON TABLE agent_sessions IS 'Agent execution sessions (chat and testing agents)';
COMMENT ON COLUMN agent_sessions.file_changes IS 'JSON object mapping file paths to change types';

CREATE TABLE agent_iterations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
    iteration_number INTEGER NOT NULL,
    llm_request JSONB NOT NULL,
    llm_response JSONB NOT NULL,
    tool_calls JSONB,
    tool_results JSONB,
    tokens_used INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_iteration_per_session UNIQUE (session_id, iteration_number)
);

CREATE INDEX idx_agent_iterations_session_id ON agent_iterations(session_id);
CREATE INDEX idx_agent_iterations_number ON agent_iterations(iteration_number);
CREATE INDEX idx_agent_iterations_timestamp ON agent_iterations(timestamp);

COMMENT ON TABLE agent_iterations IS 'Detailed logs of each agent iteration';
COMMENT ON COLUMN agent_iterations.llm_request IS 'Full prompt sent to AI';
COMMENT ON COLUMN agent_iterations.llm_response IS 'Full AI response received';

-- ============================================================================
-- ACCESSIBILITY TESTING
-- ============================================================================

CREATE TABLE testing_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tested_url VARCHAR(500) NOT NULL,
    nvda_interactions JSONB NOT NULL,
    test_results JSONB NOT NULL,
    ai_validation_results JSONB,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    total_issues INTEGER DEFAULT 0,
    severity_breakdown JSONB
);

CREATE INDEX idx_testing_sessions_user_id ON testing_sessions(user_id);
CREATE INDEX idx_testing_sessions_url ON testing_sessions(tested_url);
CREATE INDEX idx_testing_sessions_start_time ON testing_sessions(start_time);

COMMENT ON TABLE testing_sessions IS 'NVDA accessibility testing sessions';
COMMENT ON COLUMN testing_sessions.nvda_interactions IS 'All NVDA announcements and navigation data';
COMMENT ON COLUMN testing_sessions.test_results IS 'All accessibility issues found';

CREATE TABLE testing_fixes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    testing_session_id UUID NOT NULL REFERENCES testing_sessions(id) ON DELETE CASCADE,
    agent_session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
    files_modified JSONB NOT NULL,
    fix_summary TEXT,
    success BOOLEAN DEFAULT TRUE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_testing_fixes_testing_session_id ON testing_fixes(testing_session_id);
CREATE INDEX idx_testing_fixes_agent_session_id ON testing_fixes(agent_session_id);
CREATE INDEX idx_testing_fixes_timestamp ON testing_fixes(timestamp);

COMMENT ON TABLE testing_fixes IS 'Agent fixes applied to accessibility issues';

-- ============================================================================
-- DEBUG LOGS (All outputChannel.appendLine logs)
-- ============================================================================

CREATE TABLE debug_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID,
    session_type VARCHAR(50),
    log_level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    context JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_log_level CHECK (log_level IN ('INFO', 'WARN', 'ERROR', 'DEBUG')),
    CONSTRAINT valid_session_type CHECK (session_type IN ('agent', 'testing', 'chat', 'general'))
);

CREATE INDEX idx_debug_logs_user_id ON debug_logs(user_id);
CREATE INDEX idx_debug_logs_session_id ON debug_logs(session_id);
CREATE INDEX idx_debug_logs_level ON debug_logs(log_level);
CREATE INDEX idx_debug_logs_timestamp ON debug_logs(timestamp);
CREATE INDEX idx_debug_logs_session_type ON debug_logs(session_type);

COMMENT ON TABLE debug_logs IS 'All debug and application logs from extension';
COMMENT ON COLUMN debug_logs.context IS 'Additional structured data (JSON)';

-- ============================================================================
-- USAGE TRACKING (For Rate Limiting & Analytics)
-- ============================================================================

CREATE TABLE usage_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint VARCHAR(100) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    tokens_used INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_method CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH'))
);

CREATE INDEX idx_usage_stats_user_id ON usage_stats(user_id);
CREATE INDEX idx_usage_stats_timestamp ON usage_stats(timestamp);
CREATE INDEX idx_usage_stats_endpoint ON usage_stats(endpoint);
CREATE INDEX idx_usage_stats_user_timestamp ON usage_stats(user_id, timestamp);

COMMENT ON TABLE usage_stats IS 'API usage tracking for rate limiting and analytics';

-- ============================================================================
-- VSIX DOWNLOADS
-- ============================================================================

CREATE TABLE vsix_downloads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vsix_version VARCHAR(20) NOT NULL,
    download_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT
);

CREATE INDEX idx_vsix_downloads_user_id ON vsix_downloads(user_id);
CREATE INDEX idx_vsix_downloads_timestamp ON vsix_downloads(download_timestamp);
CREATE INDEX idx_vsix_downloads_version ON vsix_downloads(vsix_version);

COMMENT ON TABLE vsix_downloads IS 'Track VSIX extension downloads';

-- ============================================================================
-- HELPER FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update chat_conversations.updated_at
CREATE TRIGGER update_chat_conversations_updated_at
    BEFORE UPDATE ON chat_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function: Clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_sessions() IS 'Remove expired JWT sessions';

-- ============================================================================
-- VIEWS FOR ANALYTICS
-- ============================================================================

-- View: User usage summary
CREATE VIEW user_usage_summary AS
SELECT 
    u.id,
    u.email,
    u.created_at,
    u.last_login,
    u.is_active,
    COUNT(DISTINCT cs.id) AS total_chat_sessions,
    COUNT(DISTINCT ts.id) AS total_test_sessions,
    COUNT(DISTINCT ags.id) AS total_agent_sessions,
    COALESCE(SUM(us.tokens_used), 0) AS total_tokens_used,
    COUNT(DISTINCT vd.id) AS total_downloads,
    u.rate_limit_per_hour,
    u.rate_limit_tokens_per_day
FROM users u
LEFT JOIN chat_conversations cs ON u.id = cs.user_id
LEFT JOIN testing_sessions ts ON u.id = ts.user_id
LEFT JOIN agent_sessions ags ON u.id = ags.user_id
LEFT JOIN usage_stats us ON u.id = us.user_id
LEFT JOIN vsix_downloads vd ON u.id = vd.user_id
GROUP BY u.id, u.email, u.created_at, u.last_login, u.is_active, u.rate_limit_per_hour, u.rate_limit_tokens_per_day;

COMMENT ON VIEW user_usage_summary IS 'Comprehensive user statistics';

-- View: Rate limiting check (requests in last hour)
CREATE VIEW user_hourly_requests AS
SELECT 
    user_id,
    COUNT(*) AS requests_last_hour
FROM usage_stats
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY user_id;

COMMENT ON VIEW user_hourly_requests IS 'Request count per user in last hour';

-- View: Daily token usage
CREATE VIEW user_daily_tokens AS
SELECT 
    user_id,
    DATE(timestamp) AS usage_date,
    SUM(tokens_used) AS tokens_used
FROM usage_stats
WHERE timestamp > NOW() - INTERVAL '1 day'
GROUP BY user_id, DATE(timestamp);

COMMENT ON VIEW user_daily_tokens IS 'Token usage per user in last 24 hours';

-- View: Recent agent activity
CREATE VIEW recent_agent_activity AS
SELECT 
    ags.id AS session_id,
    ags.user_id,
    u.email,
    ags.session_type,
    ags.goal,
    ags.status,
    ags.total_iterations,
    ags.start_time,
    ags.end_time,
    EXTRACT(EPOCH FROM (COALESCE(ags.end_time, NOW()) - ags.start_time)) AS duration_seconds,
    SUM(ai.tokens_used) AS total_tokens
FROM agent_sessions ags
JOIN users u ON ags.user_id = u.id
LEFT JOIN agent_iterations ai ON ags.id = ai.session_id
GROUP BY ags.id, ags.user_id, u.email, ags.session_type, ags.goal, ags.status, 
         ags.total_iterations, ags.start_time, ags.end_time
ORDER BY ags.start_time DESC;

COMMENT ON VIEW recent_agent_activity IS 'Recent agent sessions with summary statistics';

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Create a default admin user (password: Admin123! - CHANGE THIS!)
-- Password hash for 'Admin123!' using bcrypt (12 rounds)
INSERT INTO users (email, password_hash, is_active, rate_limit_per_hour, rate_limit_tokens_per_day)
VALUES (
    'admin@accesslint.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NU7CKXlFqCzC',
    true,
    1000,
    1000000
)
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- GRANTS (Adjust based on your user setup)
-- ============================================================================

-- Grant permissions to application user (create this user separately)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO accesslint_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO accesslint_app;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO accesslint_app;

-- ============================================================================
-- SCHEMA VERSION
-- ============================================================================

CREATE TABLE schema_version (
    version VARCHAR(10) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

INSERT INTO schema_version (version, description)
VALUES ('1.0.0', 'Initial schema with users, sessions, chat, agent, testing, logs, and usage tracking');

COMMENT ON TABLE schema_version IS 'Track database schema versions';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

