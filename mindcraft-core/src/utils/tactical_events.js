export const TacticalTiers = {
    TELEMETRY: 'TELEMETRY',    // Continuous status: HP, Food, Pos
    COMMAND: 'COMMAND',        // Strategic orders from Web/User
    LIFECYCLE: 'LIFECYCLE',    // Spawn, Death, Disconnect
    INTELLIGENCE: 'INTELLIGENCE' // Tactical alerts (low health, under attack)
};

export const Importance = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

export const EventTypes = {
    RESOURCE_REQUEST: 'resource_request',
    RESOURCE_OFFER: 'resource_offer',
    RESOURCE_DELIVERED: 'resource_delivered',
    HEARTBEAT: 'heartbeat',
    BOT_SPAWNED: 'bot_spawned',
    BOT_DIED: 'bot_died',
    UNDER_ATTACK: 'under_attack',
    LOW_RESOURCES: 'low_resources',
    TASK_STATUS: 'task_status',
    WEB_COMMAND: 'web_command'
};
