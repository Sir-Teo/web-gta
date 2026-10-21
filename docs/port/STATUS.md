# Port status

Census 2026-10-21 (gta-reversed `4281f82d8a`); sweep 2026-10-11, 480 s a mission.

Per mission: what the static census flags, and what the headless sweep saw. **Reached** is the furthest instruction the mission thread was seen at, as a share of its block; **Skipped** counts the commands the census finds with no world member yet, which the game skips (a mission runs on without them); **Stops** counts those with no handler at all, where the thread would give up; **Stopped** names a command a mission thread gave up on or a page error; **Outcome** is the big message the mission printed (M_PASS* passed, M_FAIL failed); **Waiting** is where the autopilot could not take it further (a chase, a fight, a menu). See [the census](CENSUS.md) for every command and [README](README.md) for the pipeline.

| # | Mission | Authored | Silent | Skipped | Stops | Swept | Reached | Ended | Outcome | Stopped | Waiting on |
|---|---|---|---|---|---|---|---|---|---|---|---|
| MAIN | MAIN | 18 | 0 | 2 | 0 |  |  |  |  |  |  |
| player_parachute.scm | player_parachute.scm | 3 | 0 | 0 | 0 |  |  |  |  |  |  |
| parachute.scm | parachute.scm | 7 | 0 | 0 | 0 |  |  |  |  |  |  |
| bcesar2.scm | bcesar2.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| bcesar3.scm | bcesar3.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| slot_machine.scm | slot_machine.scm | 2 | 0 | 0 | 0 |  |  |  |  |  |  |
| roulette.scm | roulette.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| otb_script.scm | otb_script.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| arcade.scm | arcade.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| vending_machine.scm | vending_machine.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| food_vendor.scm | food_vendor.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| gates_script.scm | gates_script.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| gymbike.scm | gymbike.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| gymbench.scm | gymbench.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| gymtread.scm | gymtread.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| gymdumb.scm | gymdumb.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| basketb.scm | basketb.scm | 2 | 0 | 0 | 0 |  |  |  |  |  |  |
| vidpok.scm | vidpok.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| blackj.scm | blackj.scm | 2 | 0 | 0 | 0 |  |  |  |  |  |  |
| wheelo.scm | wheelo.scm | 2 | 0 | 0 | 0 |  |  |  |  |  |  |
| dealer.scm | dealer.scm | 3 | 0 | 0 | 0 |  |  |  |  |  |  |
| home_brains.scm | home_brains.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| pool_script.scm | pool_script.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| lowr_cont.scm | lowr_cont.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| burg_brains.scm | burg_brains.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| gf_meeting.scm | gf_meeting.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| gf_date.scm | gf_date.scm | 0 | 0 | 2 | 0 |  |  |  |  |  |  |
| gf_sex.scm | gf_sex.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| casino_ambience.scm | casino_ambience.scm | 28 | 0 | 0 | 0 |  |  |  |  |  |  |
| bar_ambience.scm | bar_ambience.scm | 13 | 0 | 0 | 0 |  |  |  |  |  |  |
| foodbrains.scm | foodbrains.scm | 2 | 0 | 0 | 0 |  |  |  |  |  |  |
| otb_ambience.scm | otb_ambience.scm | 5 | 0 | 0 | 0 |  |  |  |  |  |  |
| strip_ambience.scm | strip_ambience.scm | 10 | 0 | 0 | 0 |  |  |  |  |  |  |
| planes.scm | planes.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| trains.scm | trains.scm | 0 | 0 | 2 | 0 |  |  |  |  |  |  |
| zero_ambience.scm | zero_ambience.scm | 2 | 0 | 0 | 0 |  |  |  |  |  |  |
| dance.scm | dance.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| shopkeeper.scm | shopkeeper.scm | 3 | 0 | 0 | 0 |  |  |  |  |  |  |
| customer_panic.scm | customer_panic.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| bar_staff.scm | bar_staff.scm | 7 | 0 | 0 | 0 |  |  |  |  |  |  |
| bouncer.scm | bouncer.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| otb_staff.scm | otb_staff.scm | 3 | 0 | 0 | 0 |  |  |  |  |  |  |
| pchair.scm | pchair.scm | 1 | 0 | 0 | 1 |  |  |  |  |  |  |
| pcustom.scm | pcustom.scm | 1 | 0 | 0 | 1 |  |  |  |  |  |  |
| otbwtch.scm | otbwtch.scm | 1 | 0 | 0 | 1 |  |  |  |  |  |  |
| otbslp.scm | otbslp.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| otbtill.scm | otbtill.scm | 1 | 0 | 0 | 1 |  |  |  |  |  |  |
| fboothr.scm | fboothr.scm | 1 | 0 | 0 | 1 |  |  |  |  |  |  |
| fboothl.scm | fboothl.scm | 1 | 0 | 0 | 1 |  |  |  |  |  |  |
| barguy.scm | barguy.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| pedroul.scm | pedroul.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| pedcard.scm | pedcard.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| pedslot.scm | pedslot.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| dancer.scm | dancer.scm | 1 | 0 | 0 | 1 |  |  |  |  |  |  |
| stripw.scm | stripw.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| stripm.scm | stripm.scm | 3 | 0 | 0 | 0 |  |  |  |  |  |  |
| browse.scm | browse.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| copsit.scm | copsit.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| coplook.scm | coplook.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| ticket.scm | ticket.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| shopper.scm | shopper.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| ammu.scm | ammu.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| tattoo.scm | tattoo.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| barber.scm | barber.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| wardrobe.scm | wardrobe.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| clothes.scm | clothes.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| junkfud.scm | junkfud.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| carmod1.scm | carmod1.scm | 1 | 1 | 0 | 0 |  |  |  |  |  |  |
| crane1.scm | crane1.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| crane2.scm | crane2.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| crane3.scm | crane3.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| carpark1.scm | carpark1.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| impound.scm | impound.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| valet.scm | valet.scm | 0 | 0 | 5 | 0 |  |  |  |  |  |  |
| photo.scm | photo.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| prisonr.scm | prisonr.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| camera.scm | camera.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| debt.scm | debt.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| hotdog.scm | hotdog.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| 0 | INITIAL | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| 1 | INITIL2 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 2 | INTRO | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 3 | NONE | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 4 | DUAL | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 5 | SHTR | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 6 | GRAV | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 7 | OTB | 0 | 0 | 3 | 0 |  |  |  |  |  |  |
| 8 | POOL2 | 4 | 0 | 8 | 0 |  |  |  |  |  |  |
| 9 | LOWR | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 10 | ZERO5 | 0 | 0 | 9 | 0 |  |  |  |  |  |  |
| 11 | INTRO1 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 12 | INTRO2 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 13 | SWEET1 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 14 | SWEET1B | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 15 | SWEET3 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 16 | SWEET2 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 17 | SWEET4 | 0 | 0 | 0 | 0 | yes | 43.4% | yes | failed |  |  |
| 18 | HOODS5 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 19 | SWEET6 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 20 | SWEET7 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 21 | CRASH4 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 22 | CRASH1 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 23 | DRUGS3 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 24 | GUNS1 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 25 | RYDER3 | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| 26 | RYDER2 | 3 | 0 | 0 | 0 |  |  |  |  |  |  |
| 27 | TWAR7 | 0 | 0 | 1 | 0 |  |  |  |  |  |  |
| 28 | SMOKE2 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 29 | SMOKE3 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 30 | DRUGS1 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 31 | MUSIC1 | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| 32 | MUSIC2 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 33 | MUSIC3 | 10 | 0 | 1 | 0 |  |  |  |  |  |  |
| 34 | MUSIC5 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 35 | CPRACE | 4 | 0 | 0 | 0 |  |  |  |  |  |  |
| 36 | CESAR1 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 37 | DRUGS4 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 38 | LA1FIN2 | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| 39 | BCRASH1 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 40 | CATALIN | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 41 | CAT1 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 42 | CAT2 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 43 | CAT3 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 44 | CAT4 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 45 | CATCUT | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 46 | TRUTH1 | 6 | 0 | 0 | 0 |  |  |  |  |  |  |
| 47 | TRUTH2 | 0 | 0 | 1 | 0 |  |  |  |  |  |  |
| 48 | BCESAR4 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 49 | GARAG1 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 50 | DECON | 0 | 0 | 5 | 0 |  |  |  |  |  |  |
| 51 | SCRASH3 | 0 | 0 | 2 | 0 |  |  |  |  |  |  |
| 52 | SCRASH2 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 53 | WUZI1 | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| 54 | FARLIE4 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 55 | DRIV6 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 56 | WUZI2 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 57 | WUZI5 | 6 | 0 | 1 | 0 |  |  |  |  |  |  |
| 58 | SYN1 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 59 | SYN2 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 60 | SYN3 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 61 | SYND4 | 0 | 0 | 3 | 0 |  |  |  |  |  |  |
| 62 | SYN6 | 0 | 0 | 1 | 0 |  |  |  |  |  |  |
| 63 | SYN7 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 64 | SYN5 | 0 | 0 | 1 | 0 |  |  |  |  |  |  |
| 65 | DRIV2 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 66 | DRIV3 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 67 | STEAL1 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 68 | STEAL2 | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| 69 | STEAL4 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 70 | STEAL5 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 71 | DSKOOL | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 72 | ZERO1 | 0 | 0 | 1 | 0 |  |  |  |  |  |  |
| 73 | ZERO2 | 0 | 0 | 13 | 0 |  |  |  |  |  |  |
| 74 | ZERO4 | 0 | 0 | 10 | 0 |  |  |  |  |  |  |
| 75 | TORENO1 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 76 | TORENO2 | 4 | 0 | 0 | 0 |  |  |  |  |  |  |
| 77 | DES3 | 0 | 0 | 3 | 0 |  |  |  |  |  |  |
| 78 | DESERT4 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 79 | DESERT6 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 80 | DESERT9 | 1 | 0 | 7 | 0 |  |  |  |  |  |  |
| 81 | MAF4 | 1 | 0 | 1 | 0 |  |  |  |  |  |  |
| 82 | DES10 | 0 | 0 | 2 | 0 |  |  |  |  |  |  |
| 83 | DESERT5 | 0 | 0 | 1 | 0 |  |  |  |  |  |  |
| 84 | CASINO1 | 0 | 0 | 1 | 0 |  |  |  |  |  |  |
| 85 | CASINO2 | 3 | 0 | 3 | 0 |  |  |  |  |  |  |
| 86 | CASINO3 | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| 87 | CASINO7 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 88 | CASINO4 | 2 | 0 | 2 | 0 |  |  |  |  |  |  |
| 89 | CASINO5 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 90 | CASINO6 | 2 | 0 | 5 | 0 |  |  |  |  |  |  |
| 91 | CASINO9 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 92 | CASIN10 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 93 | VCRASH1 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 94 | VCR2 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 95 | DOC2 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 96 | HEIST1 | 0 | 0 | 1 | 0 |  |  |  |  |  |  |
| 97 | HEIST3 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 98 | HEIST2 | 0 | 0 | 1 | 0 |  |  |  |  |  |  |
| 99 | HEIST4 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 100 | HEIST5 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 101 | HEIST9 | 3 | 0 | 1 | 0 |  |  |  |  |  |  |
| 102 | MANSIO1 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 103 | MANSIO2 | 0 | 0 | 3 | 0 |  |  |  |  |  |  |
| 104 | MANSIO3 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 105 | MANSON5 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 106 | GROVE1 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 107 | GROVE2 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 108 | RIOT1 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 109 | RIOT2 | 12 | 0 | 3 | 0 |  |  |  |  |  |  |
| 110 | FINALEA | 1 | 0 | 1 | 0 |  |  |  |  |  |  |
| 111 | FINALEB | 31 | 0 | 1 | 0 |  |  |  |  |  |  |
| 112 | FINALEC | 0 | 0 | 3 | 0 |  |  |  |  |  |  |
| 113 | SHRANGE | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 114 | GYMLS | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 115 | GYMSF | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 116 | GYMLV | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 117 | TRUCK | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| 118 | QUARRY | 1 | 0 | 5 | 0 |  |  |  |  |  |  |
| 119 | BOAT | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 120 | BSKOOL | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 121 | TAXIODD | 3 | 0 | 0 | 0 |  |  |  |  |  |  |
| 122 | AMBULAN | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 123 | FIRETRU | 3 | 0 | 0 | 0 |  |  |  |  |  |  |
| 124 | COPCAR | 5 | 0 | 0 | 0 |  |  |  |  |  |  |
| 125 | BURGJB | 0 | 0 | 3 | 0 |  |  |  |  |  |  |
| 126 | FREIGHT | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 127 | PIMP | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 128 | BLOOD | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 129 | KICKSTA | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 130 | TRIA | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 131 | BCOUR | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 132 | MTBIKER | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 133 | STUNT | 0 | 0 | 1 | 0 |  |  |  |  |  |  |
| 134 | BUYPRO1 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |

## Next up

The first commands of the census queue that gta-reversed has a reversed handler for (port the function named), then the first with none (research or keep the stand-in):

- **GET_RID_OF_PLAYER_PROSTITUTE** (authored, 1 sites, first in MAIN): `GameCommands.cpp:63` GetRidOfPlayerProstitute. adapter comments name an authored stand-in (getRidOfPlayerProstitute)
- **GET_CHAR_VELOCITY** (authored, 11 sites, first in player_parachute.scm): `CharacterCommands.cpp:309` GetCharVelocity. handler comments name an authored stand-in
- **GET_DEBUG_CAMERA_COORDINATES** (authored, 6 sites, first in basketb.scm): `CameraCommands.cpp:107` GetDebugCameraCoordinates. adapter comments name an authored stand-in (debugCameraSource)
- **GET_DEBUG_CAMERA_POINT_AT** (authored, 5 sites, first in basketb.scm): `CameraCommands.cpp:112` GetDebugCameraPointAt. adapter comments name an authored stand-in (debugCameraSource)
- **SET_CHAR_WANTED_BY_POLICE** (authored, 3 sites, first in dealer.scm): `CharacterCommands.cpp:3238` SetCharWantedByPolice. adapter comments name an authored stand-in (setPedWantedByPolice)
- **SKIP_TO_NEXT_ALLOWED_STATION** (skipped, 2 sites, first in trains.scm): `VehicleCommands.cpp:76` SkipToNextAllowedStation. adapter lacks skipTrainToNextStation (skipped: outputs read as none)
- **IS_CHAR_USING_MAP_ATTRACTOR** (authored, 20 sites, first in pchair.scm): `CharacterCommands.cpp:3282` IsCharUsingMapAttractor. handler comments name an authored stand-in
- **REMOVE_RC_BUGGY** (skipped, 14 sites, first in ZERO5): `VehicleCommands.cpp:23` RemoveRCBuggy. adapter lacks removeRCBuggy (skipped: outputs read as none)
- **GIVE_REMOTE_CONTROLLED_MODEL_TO_PLAYER** (skipped, 2 sites, first in ZERO5): `PlayerCommands.cpp:260` GiveRemoteControlledModelToPlayer. adapter lacks giveRemoteControlledModelToPlayer (skipped: outputs read as none)
- **IS_PLAYER_IN_REMOTE_MODE** (skipped, 1 sites, first in ZERO5): `PlayerCommands.cpp:203` IsPlayerInRemoteMode. dispatch unreversed; follows the routines it reaches; adapter lacks isPlayerInRemoteMode (skipped: outputs read as none)
- **IS_CHAR_AT_SCRIPTED_ATTRACTOR** (skipped, 2 sites, first in CASINO6): `CharacterCommands.cpp:3035` IsCharAtScriptedAttractor. adapter lacks pedIsAtScriptedAttractor (skipped: outputs read as none)
- **CAN_CHAR_SEE_DEAD_CHAR** (skipped, 3 sites, first in MANSIO2): `CharacterCommands.cpp:2283` CanCharSeeDeadChar. adapter lacks pedCanSeeDeadPed (skipped: outputs read as none)
- **SET_PLAYER_MOOD** (skipped, 2 sites, first in FINALEA): `PlayerCommands.cpp:278` SetPlayerMood. adapter lacks setPlayerMood (skipped: outputs read as none)
- **DRAW_SHADOW** (skipped, 1 sites, first in STUNT): `GameCommands.cpp:166` DrawShadow. adapter lacks drawShadow (skipped: outputs read as none)

- ROTATE_OBJECT (authored, 41 sites, first in MAIN; reference absent). handler comments name an authored stand-in
- ARE_MEASUREMENTS_IN_METRES (authored, 6 sites, first in MAIN; reference absent). adapter comments name an authored stand-in (measurementsAreInMetres)
- ACTIVATE_SAVE_MENU (skipped, 1 sites, first in MAIN; reference absent). adapter lacks activateSaveMenu (skipped: outputs read as none)
- HAS_SAVE_GAME_FINISHED (skipped, 1 sites, first in MAIN; reference absent). adapter lacks hasSaveGameFinished (skipped: outputs read as none)
- GET_USER_OF_CLOSEST_MAP_ATTRACTOR (authored, 11 sites, first in slot_machine.scm; reference absent). handler comments name an authored stand-in
- TASK_PLAY_ANIM_SECONDARY (authored, 6 sites, first in vending_machine.scm; reference absent). adapter comments name an authored stand-in (taskPlayAnimSecondary)
- LOCK_DOOR (skipped, 3 sites, first in gf_date.scm; reference absent). adapter lacks lockDoor (skipped: outputs read as none)
- ADD_ATTRACTOR (authored, 62 sites, first in casino_ambience.scm; reference absent). adapter comments name an authored stand-in (addAttractor)
- GET_RANDOM_CHAR_IN_SPHERE_NO_BRAIN (authored, 6 sites, first in casino_ambience.scm; reference handler-disabled). handler comments name an authored stand-in
- TASK_USE_CLOSEST_MAP_ATTRACTOR (stops, 7 sites, first in pchair.scm; reference absent). no handler (the thread gives up)
- REQUEST_VEHICLE_MOD (authored, 5 sites, first in carmod1.scm; reference absent). adapter comments name an authored stand-in (requestVehicleMod)
- MANAGE_ALL_POPULATION (silent, 1 sites, first in carmod1.scm; reference absent). adapter lacks manageAllPopulation
- GET_CAR_BLOCKING_CAR (skipped, 3 sites, first in valet.scm; reference absent). adapter lacks getCarBlockingCar (skipped: outputs read as none)
- GET_PARKING_NODE_IN_AREA (skipped, 3 sites, first in valet.scm; reference absent). adapter lacks getParkingNodeInArea (skipped: outputs read as none)
- IS_CHAR_STUCK_UNDER_CAR (skipped, 2 sites, first in valet.scm; reference handler-disabled). adapter lacks isCharStuckUnderCar (skipped: outputs read as none)
