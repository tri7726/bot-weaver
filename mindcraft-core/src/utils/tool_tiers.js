const TIERS = {
    'pickaxe': ['wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'golden_pickaxe', 'diamond_pickaxe', 'netherite_pickaxe'],
    'axe': ['wooden_axe', 'stone_axe', 'iron_axe', 'golden_axe', 'diamond_axe', 'netherite_axe'],
    'shovel': ['wooden_shovel', 'stone_shovel', 'iron_shovel', 'golden_shovel', 'diamond_shovel', 'netherite_shovel'],
    'sword': ['wooden_sword', 'stone_sword', 'iron_sword', 'golden_sword', 'diamond_sword', 'netherite_sword']
};

export function isBetterOrEqual(haveName, needName) {
    if (!haveName || !needName) return false;
    
    // Normalize names
    const have = haveName.toLowerCase().replace('minecraft:', '');
    const need = needName.toLowerCase().replace('minecraft:', '');

    if (have === need) return true;

    // Find category
    for (const category in TIERS) {
        const list = TIERS[category];
        const needIdx = list.indexOf(need);
        const haveIdx = list.indexOf(have);

        if (needIdx !== -1 && haveIdx !== -1) {
            return haveIdx >= needIdx;
        }
    }

    // Default to strict match for unknown items
    return have.includes(need);
}
