export function shouldJumpCrit(bot, target) {
    if (!bot.entity.onGround) return false;
    const dist = bot.entity.position.distanceTo(target.position);
    return dist < 3.5; // Only jump if close enough to land a hit
}

export function applyWTap(bot) {
    // Sprint-reset logic: Briefly stop forward movement to reset knockback
    bot.setControlState('forward', false);
    setTimeout(() => {
        if (!bot.interrupt_code) bot.setControlState('forward', true);
    }, 50);
}

export function getStrafePosition(bot, target, direction = 1) {
    // Calculate a point around the target to strafe
    const targetPos = target.position;
    const botPos = bot.entity.position;
    const radius = 3;
    
    // Simple rotation logic
    const angle = Math.atan2(botPos.z - targetPos.z, botPos.x - targetPos.x);
    const newAngle = angle + (0.5 * direction);
    
    return {
        x: targetPos.x + Math.cos(newAngle) * radius,
        y: targetPos.y,
        z: targetPos.z + Math.sin(newAngle) * radius
    };
}

export function isLowHealth(bot) {
    return bot.health <= 6; // 3 hearts
}

export function shouldEscape(bot) {
    return bot.health <= 4; // 2 hearts
}

export function getEscapeTrajectory(bot) {
    // Look 45 degrees up and away from the nearest enemy
    const yaw = bot.entity.yaw + Math.PI; // Opposite direction
    const pitch = -Math.PI / 4; // 45 degrees up
    return { yaw, pitch };
}

export function getFormationPosition(leaderPos, leaderYaw, index, totalBots, type = 'diamond') {
    const spacing = 3;
    let offsetX = 0;
    let offsetZ = 0;

    if (type === 'diamond') {
        const positions = [
            { x: 0, z: 0 },              // Leader
            { x: -spacing, z: -spacing }, // Left Flank
            { x: spacing, z: -spacing },  // Right Flank
            { x: 0, z: -spacing * 2 },    // Rear
            { x: -spacing * 2, z: -spacing * 2 }, // Outer Left
            { x: spacing * 2, z: -spacing * 2 }   // Outer Right
        ];
        const pos = positions[index % positions.length];
        offsetX = pos.x;
        offsetZ = pos.z;
    }

    // Rotate offsets based on leader's yaw
    const cos = Math.cos(leaderYaw);
    const sin = Math.sin(leaderYaw);
    
    return {
        x: leaderPos.x + (offsetX * cos - offsetZ * sin),
        y: leaderPos.y,
        z: leaderPos.z + (offsetX * sin + offsetZ * cos)
    };
}
