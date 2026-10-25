# Recruitment capacity from native total respect

The browser kept an independent respect value starting at 40 out of 100. Group
capacity multiplied it by ten, giving five available followers regardless of
the native stat. Rival kills and turf rewards changed that separate value;
script writes, native kill penalties and restored stat storage did not.

CStats::FindMaxNumberOfGroupMembers (PC 0x559A50) reads STAT_TOTAL_RESPECT (64)
directly. It is distinct from STAT_RESPECT (68). Its thresholds are:

| Total respect | Maximum followers |
| --- | --- |
| Below 10 | 0 |
| 10 to below 60 | 2 |
| 60 to below 160 | 3 |
| 160 to below 330 | 4 |
| 330 to below 540 | 5 |
| 540 to below 800 | 6 |
| 800 and above | 7 |

Source: [Stats.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Stats.cpp),
revision 4281f82d8af83e14935ac84a69dfd1ceebb9f256.
DisplayScriptStatUpdateMessage (0x55B980) also derives its gang-strength bar's
maximum from this function, capped by m_nScriptLimitToGangSize.

The existing threshold function now requires an explicit total-respect value.
Recruitment and making room for mission peds read the current SCM stat store
through WorldPedestrians.totalRespect. FIND_MAX_NUMBER_OF_GROUP_MEMBERS and
the gang-strength HUD bar read the same stat. No second respect store remains.
Without a stat provider an isolated crowd has zero total respect; recruitment
fixtures that need followers supply their own explicit value.

The recruitment adapter retains its script gang-size limit, city-unlocked
restriction and Recruit Anyone cheat handling. The script query returns the
respect-based capacity itself, before those recruitment restrictions. Kill
and turf callbacks still change native STAT_RESPECT through their existing
paths; total-respect calculation remains the game's/script's responsibility.
This does not establish complete original stat calculation, recruitment tasks,
group scheduling or PC input/pose equivalence.

Unit checks cover the threshold boundaries, live ScmStats changes, the
distinction between stats 64 and 68, script/city limits and making room while
retaining mission members. The browser regression supplies eight loaded actors
as street candidates, retains actual recruitment/group callbacks and compares
the script query with recruit attempts at every boundary, after reducing
respect, with a script limit and away from Los Santos.
