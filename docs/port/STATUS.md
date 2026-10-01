# Port status

Census 2026-10-01 (gta-reversed `9e9444d734`); sweep 2026-09-30, 2400 s a mission (INTRO2 swept again 2026-10-01 with the bot; SWEET1B, SWEET2 and SWEET3 swept with the bot 2026-10-01 and passed).

Per mission: what the static census flags, and what the headless sweep saw. **Reached** is the furthest instruction the mission thread was seen at, as a share of its block; **Skipped** counts the commands the census finds with no world member yet, which the game skips (a mission runs on without them); **Stops** counts those with no handler at all, where the thread would give up; **Stopped** names a command a mission thread gave up on or a page error; **Outcome** is the big message the mission printed (M_PASS* passed, M_FAIL failed); **Waiting** is where the autopilot could not take it further (a chase, a fight, a menu). See [the census](CENSUS.md) for every command and [README](README.md) for the pipeline.

| # | Mission | Authored | Silent | Skipped | Stops | Swept | Reached | Ended | Outcome | Stopped | Waiting on |
|---|---|---|---|---|---|---|---|---|---|---|---|
| MAIN | MAIN | 22 | 33 | 22 | 0 |  |  |  |  |  |  |
| player_parachute.scm | player_parachute.scm | 0 | 0 | 6 | 6 |  |  |  |  |  |  |
| parachute.scm | parachute.scm | 0 | 0 | 9 | 5 |  |  |  |  |  |  |
| bcesar2.scm | bcesar2.scm | 2 | 8 | 0 | 0 |  |  |  |  |  |  |
| bcesar3.scm | bcesar3.scm | 0 | 8 | 0 | 2 |  |  |  |  |  |  |
| slot_machine.scm | slot_machine.scm | 3 | 7 | 0 | 1 |  |  |  |  |  |  |
| roulette.scm | roulette.scm | 1 | 5 | 2 | 29 |  |  |  |  |  |  |
| otb_script.scm | otb_script.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| arcade.scm | arcade.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| vending_machine.scm | vending_machine.scm | 2 | 7 | 0 | 0 |  |  |  |  |  |  |
| food_vendor.scm | food_vendor.scm | 2 | 1 | 0 | 0 |  |  |  |  |  |  |
| gates_script.scm | gates_script.scm | 1 | 2 | 0 | 0 |  |  |  |  |  |  |
| gymbike.scm | gymbike.scm | 2 | 3 | 0 | 0 |  |  |  |  |  |  |
| gymbench.scm | gymbench.scm | 1 | 4 | 0 | 0 |  |  |  |  |  |  |
| gymtread.scm | gymtread.scm | 0 | 4 | 0 | 0 |  |  |  |  |  |  |
| gymdumb.scm | gymdumb.scm | 1 | 3 | 0 | 0 |  |  |  |  |  |  |
| basketb.scm | basketb.scm | 12 | 2 | 10 | 0 |  |  |  |  |  |  |
| vidpok.scm | vidpok.scm | 0 | 2 | 0 | 11 |  |  |  |  |  |  |
| blackj.scm | blackj.scm | 3 | 0 | 14 | 127 |  |  |  |  |  |  |
| wheelo.scm | wheelo.scm | 3 | 0 | 0 | 28 |  |  |  |  |  |  |
| dealer.scm | dealer.scm | 4 | 0 | 3 | 0 |  |  |  |  |  |  |
| home_brains.scm | home_brains.scm | 0 | 0 | 0 | 1 |  |  |  |  |  |  |
| pool_script.scm | pool_script.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| lowr_cont.scm | lowr_cont.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| burg_brains.scm | burg_brains.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| gf_meeting.scm | gf_meeting.scm | 0 | 0 | 3 | 0 |  |  |  |  |  |  |
| gf_date.scm | gf_date.scm | 1 | 0 | 13 | 56 |  |  |  |  |  |  |
| gf_sex.scm | gf_sex.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| casino_ambience.scm | casino_ambience.scm | 28 | 0 | 0 | 1 |  |  |  |  |  |  |
| bar_ambience.scm | bar_ambience.scm | 13 | 0 | 0 | 0 |  |  |  |  |  |  |
| foodbrains.scm | foodbrains.scm | 2 | 0 | 0 | 0 |  |  |  |  |  |  |
| otb_ambience.scm | otb_ambience.scm | 5 | 0 | 0 | 0 |  |  |  |  |  |  |
| strip_ambience.scm | strip_ambience.scm | 11 | 0 | 0 | 2 |  |  |  |  |  |  |
| planes.scm | planes.scm | 6 | 0 | 3 | 3 |  |  |  |  |  |  |
| trains.scm | trains.scm | 0 | 0 | 2 | 1 |  |  |  |  |  |  |
| zero_ambience.scm | zero_ambience.scm | 2 | 0 | 0 | 0 |  |  |  |  |  |  |
| dance.scm | dance.scm | 0 | 234 | 4 | 4 |  |  |  |  |  |  |
| shopkeeper.scm | shopkeeper.scm | 3 | 0 | 0 | 0 |  |  |  |  |  |  |
| customer_panic.scm | customer_panic.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| bar_staff.scm | bar_staff.scm | 7 | 0 | 0 | 0 |  |  |  |  |  |  |
| bouncer.scm | bouncer.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| otb_staff.scm | otb_staff.scm | 3 | 0 | 0 | 0 |  |  |  |  |  |  |
| pchair.scm | pchair.scm | 1 | 0 | 4 | 3 |  |  |  |  |  |  |
| pcustom.scm | pcustom.scm | 1 | 0 | 0 | 1 |  |  |  |  |  |  |
| otbwtch.scm | otbwtch.scm | 1 | 0 | 0 | 1 |  |  |  |  |  |  |
| otbslp.scm | otbslp.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| otbtill.scm | otbtill.scm | 1 | 0 | 0 | 1 |  |  |  |  |  |  |
| fboothr.scm | fboothr.scm | 1 | 0 | 1 | 3 |  |  |  |  |  |  |
| fboothl.scm | fboothl.scm | 1 | 0 | 1 | 3 |  |  |  |  |  |  |
| barguy.scm | barguy.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| pedroul.scm | pedroul.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| pedcard.scm | pedcard.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| pedslot.scm | pedslot.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| dancer.scm | dancer.scm | 1 | 0 | 0 | 1 |  |  |  |  |  |  |
| stripw.scm | stripw.scm | 1 | 0 | 0 | 3 |  |  |  |  |  |  |
| stripm.scm | stripm.scm | 3 | 0 | 0 | 0 |  |  |  |  |  |  |
| browse.scm | browse.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| copsit.scm | copsit.scm | 1 | 0 | 2 | 0 |  |  |  |  |  |  |
| coplook.scm | coplook.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| ticket.scm | ticket.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| shopper.scm | shopper.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| ammu.scm | ammu.scm | 0 | 1 | 0 | 0 |  |  |  |  |  |  |
| tattoo.scm | tattoo.scm | 14 | 3 | 1 | 0 |  |  |  |  |  |  |
| barber.scm | barber.scm | 4 | 4 | 0 | 0 |  |  |  |  |  |  |
| wardrobe.scm | wardrobe.scm | 13 | 3 | 0 | 0 |  |  |  |  |  |  |
| clothes.scm | clothes.scm | 8 | 3 | 0 | 0 |  |  |  |  |  |  |
| junkfud.scm | junkfud.scm | 0 | 2 | 0 | 0 |  |  |  |  |  |  |
| carmod1.scm | carmod1.scm | 0 | 0 | 17 | 32 |  |  |  |  |  |  |
| crane1.scm | crane1.scm | 1 | 0 | 6 | 0 |  |  |  |  |  |  |
| crane2.scm | crane2.scm | 1 | 0 | 5 | 0 |  |  |  |  |  |  |
| crane3.scm | crane3.scm | 0 | 0 | 2 | 0 |  |  |  |  |  |  |
| carpark1.scm | carpark1.scm | 0 | 0 | 0 | 57 |  |  |  |  |  |  |
| impound.scm | impound.scm | 0 | 26 | 3 | 6 |  |  |  |  |  |  |
| valet.scm | valet.scm | 0 | 2 | 10 | 2 |  |  |  |  |  |  |
| photo.scm | photo.scm | 1 | 0 | 2 | 0 |  |  |  |  |  |  |
| prisonr.scm | prisonr.scm | 0 | 0 | 0 | 1 |  |  |  |  |  |  |
| camera.scm | camera.scm | 0 | 0 | 0 | 15 |  |  |  |  |  |  |
| debt.scm | debt.scm | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| hotdog.scm | hotdog.scm | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| 0 | INITIAL | 28 | 0 | 0 | 0 |  |  |  |  |  |  |
| 1 | INITIL2 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 2 | INTRO | 22 | 6 | 0 | 0 |  |  |  |  |  |  |
| 3 | NONE | 0 | 1 | 0 | 0 |  |  |  |  |  |  |
| 4 | DUAL | 0 | 1 | 0 | 0 |  |  |  |  |  |  |
| 5 | SHTR | 0 | 2 | 0 | 0 |  |  |  |  |  |  |
| 6 | GRAV | 0 | 2 | 0 | 0 |  |  |  |  |  |  |
| 7 | OTB | 0 | 1 | 3 | 0 |  |  |  |  |  |  |
| 8 | POOL2 | 14 | 3 | 15 | 0 |  |  |  |  |  |  |
| 9 | LOWR | 2 | 3 | 0 | 0 |  |  |  |  |  |  |
| 10 | ZERO5 | 1 | 1 | 10 | 0 |  |  |  |  |  |  |
| 11 | INTRO1 | 12 | 30 | 0 | 0 | yes | 98.2% | yes | **passed** |  |  |
| 12 | INTRO2 | 6 | 29 | 0 | 0 | yes | 81.4% | yes | **passed** |  |  |
| 13 | SWEET1 | 7 | 32 | 0 | 0 | yes | 90% | yes | **passed** |  |  |
| 14 | SWEET1B | 2 | 38 | 0 | 0 | yes | 99.6% | yes | **passed** |  |  |
| 15 | SWEET3 | 8 | 47 | 0 | 0 |  |  |  |  |  |  |
| 16 | SWEET2 | 3 | 43 | 0 | 0 | yes | 87.8% | yes | **passed** |  |  |
| 17 | SWEET4 | 1 | 6 | 0 | 0 |  |  |  |  |  |  |
| 18 | HOODS5 | 0 | 12 | 0 | 0 |  |  |  |  |  |  |
| 19 | SWEET6 | 6 | 22 | 0 | 0 |  |  |  |  |  |  |
| 20 | SWEET7 | 0 | 9 | 0 | 0 |  |  |  |  |  |  |
| 21 | CRASH4 | 7 | 8 | 0 | 0 |  |  |  |  |  |  |
| 22 | CRASH1 | 5 | 14 | 0 | 0 |  |  |  |  |  |  |
| 23 | DRUGS3 | 3 | 12 | 0 | 0 |  |  |  |  |  |  |
| 24 | GUNS1 | 12 | 96 | 5 | 0 |  |  |  |  |  |  |
| 25 | RYDER3 | 14 | 32 | 0 | 0 |  |  |  |  |  |  |
| 26 | RYDER2 | 26 | 85 | 0 | 0 |  |  |  |  |  |  |
| 27 | TWAR7 | 5 | 64 | 1 | 0 |  |  |  |  |  |  |
| 28 | SMOKE2 | 2 | 24 | 0 | 0 |  |  |  |  |  |  |
| 29 | SMOKE3 | 5 | 68 | 0 | 0 |  |  |  |  |  |  |
| 30 | DRUGS1 | 4 | 67 | 26 | 0 |  |  |  |  |  |  |
| 31 | MUSIC1 | 7 | 6 | 8 | 0 |  |  |  |  |  |  |
| 32 | MUSIC2 | 4 | 25 | 3 | 0 |  |  |  |  |  |  |
| 33 | MUSIC3 | 37 | 39 | 8 | 0 |  |  |  |  |  |  |
| 34 | MUSIC5 | 6 | 21 | 0 | 0 |  |  |  |  |  |  |
| 35 | CPRACE | 2 | 7 | 21 | 0 |  |  |  |  |  |  |
| 36 | CESAR1 | 0 | 4 | 0 | 0 |  |  |  |  |  |  |
| 37 | DRUGS4 | 8 | 121 | 59 | 0 |  |  |  |  |  |  |
| 38 | LA1FIN2 | 4 | 13 | 0 | 0 |  |  |  |  |  |  |
| 39 | BCRASH1 | 0 | 1 | 1 | 0 |  |  |  |  |  |  |
| 40 | CATALIN | 0 | 4 | 0 | 0 |  |  |  |  |  |  |
| 41 | CAT1 | 1 | 138 | 0 | 0 |  |  |  |  |  |  |
| 42 | CAT2 | 10 | 14 | 1 | 0 |  |  |  |  |  |  |
| 43 | CAT3 | 4 | 13 | 5 | 0 |  |  |  |  |  |  |
| 44 | CAT4 | 2 | 87 | 1 | 0 |  |  |  |  |  |  |
| 45 | CATCUT | 0 | 6 | 0 | 0 |  |  |  |  |  |  |
| 46 | TRUTH1 | 3 | 41 | 0 | 0 |  |  |  |  |  |  |
| 47 | TRUTH2 | 2 | 31 | 16 | 0 |  |  |  |  |  |  |
| 48 | BCESAR4 | 1 | 0 | 2 | 0 |  |  |  |  |  |  |
| 49 | GARAG1 | 11 | 26 | 5 | 0 |  |  |  |  |  |  |
| 50 | DECON | 5 | 29 | 9 | 0 |  |  |  |  |  |  |
| 51 | SCRASH3 | 5 | 17 | 11 | 0 |  |  |  |  |  |  |
| 52 | SCRASH2 | 0 | 4 | 2 | 0 |  |  |  |  |  |  |
| 53 | WUZI1 | 2 | 18 | 1 | 0 |  |  |  |  |  |  |
| 54 | FARLIE4 | 3 | 8 | 1 | 0 |  |  |  |  |  |  |
| 55 | DRIV6 | 2 | 9 | 8 | 0 |  |  |  |  |  |  |
| 56 | WUZI2 | 9 | 1 | 29 | 0 |  |  |  |  |  |  |
| 57 | WUZI5 | 10 | 45 | 4 | 0 |  |  |  |  |  |  |
| 58 | SYN1 | 1 | 9 | 1 | 0 |  |  |  |  |  |  |
| 59 | SYN2 | 2 | 90 | 0 | 0 |  |  |  |  |  |  |
| 60 | SYN3 | 3 | 17 | 1 | 0 |  |  |  |  |  |  |
| 61 | SYND4 | 1 | 14 | 5 | 0 |  |  |  |  |  |  |
| 62 | SYN6 | 4 | 8 | 5 | 0 |  |  |  |  |  |  |
| 63 | SYN7 | 4 | 46 | 2 | 0 |  |  |  |  |  |  |
| 64 | SYN5 | 5 | 35 | 14 | 0 |  |  |  |  |  |  |
| 65 | DRIV2 | 13 | 1 | 4 | 0 |  |  |  |  |  |  |
| 66 | DRIV3 | 2 | 56 | 2 | 0 |  |  |  |  |  |  |
| 67 | STEAL1 | 13 | 8 | 1 | 0 |  |  |  |  |  |  |
| 68 | STEAL2 | 12 | 25 | 14 | 0 |  |  |  |  |  |  |
| 69 | STEAL4 | 9 | 30 | 65 | 0 |  |  |  |  |  |  |
| 70 | STEAL5 | 12 | 20 | 1 | 0 |  |  |  |  |  |  |
| 71 | DSKOOL | 15 | 11 | 2 | 0 |  |  |  |  |  |  |
| 72 | ZERO1 | 7 | 71 | 21 | 0 |  |  |  |  |  |  |
| 73 | ZERO2 | 4 | 53 | 13 | 0 |  |  |  |  |  |  |
| 74 | ZERO4 | 18 | 24 | 22 | 0 |  |  |  |  |  |  |
| 75 | TORENO1 | 3 | 13 | 0 | 0 |  |  |  |  |  |  |
| 76 | TORENO2 | 7 | 37 | 18 | 0 |  |  |  |  |  |  |
| 77 | DES3 | 10 | 41 | 25 | 0 |  |  |  |  |  |  |
| 78 | DESERT4 | 0 | 0 | 0 | 0 |  |  |  |  |  |  |
| 79 | DESERT6 | 1 | 11 | 4 | 0 |  |  |  |  |  |  |
| 80 | DESERT9 | 7 | 19 | 18 | 0 |  |  |  |  |  |  |
| 81 | MAF4 | 10 | 39 | 50 | 0 |  |  |  |  |  |  |
| 82 | DES10 | 1 | 7 | 3 | 0 |  |  |  |  |  |  |
| 83 | DESERT5 | 11 | 13 | 16 | 0 |  |  |  |  |  |  |
| 84 | CASINO1 | 1 | 16 | 1 | 0 |  |  |  |  |  |  |
| 85 | CASINO2 | 22 | 19 | 3 | 0 |  |  |  |  |  |  |
| 86 | CASINO3 | 11 | 15 | 1 | 0 |  |  |  |  |  |  |
| 87 | CASINO7 | 1 | 0 | 0 | 0 |  |  |  |  |  |  |
| 88 | CASINO4 | 5 | 78 | 7 | 0 |  |  |  |  |  |  |
| 89 | CASINO5 | 2 | 2 | 0 | 0 |  |  |  |  |  |  |
| 90 | CASINO6 | 12 | 6 | 11 | 0 |  |  |  |  |  |  |
| 91 | CASINO9 | 7 | 10 | 10 | 0 |  |  |  |  |  |  |
| 92 | CASIN10 | 8 | 46 | 8 | 0 |  |  |  |  |  |  |
| 93 | VCRASH1 | 0 | 1 | 2 | 0 |  |  |  |  |  |  |
| 94 | VCR2 | 2 | 13 | 0 | 0 |  |  |  |  |  |  |
| 95 | DOC2 | 2 | 48 | 0 | 0 |  |  |  |  |  |  |
| 96 | HEIST1 | 1 | 54 | 3 | 0 |  |  |  |  |  |  |
| 97 | HEIST3 | 7 | 42 | 0 | 0 |  |  |  |  |  |  |
| 98 | HEIST2 | 5 | 22 | 3 | 0 |  |  |  |  |  |  |
| 99 | HEIST4 | 1 | 13 | 5 | 0 |  |  |  |  |  |  |
| 100 | HEIST5 | 2 | 51 | 14 | 0 |  |  |  |  |  |  |
| 101 | HEIST9 | 10 | 126 | 14 | 0 |  |  |  |  |  |  |
| 102 | MANSIO1 | 14 | 2 | 3 | 0 |  |  |  |  |  |  |
| 103 | MANSIO2 | 4 | 17 | 26 | 0 |  |  |  |  |  |  |
| 104 | MANSIO3 | 5 | 20 | 0 | 0 |  |  |  |  |  |  |
| 105 | MANSON5 | 3 | 6 | 0 | 0 |  |  |  |  |  |  |
| 106 | GROVE1 | 3 | 104 | 0 | 0 |  |  |  |  |  |  |
| 107 | GROVE2 | 0 | 20 | 0 | 0 |  |  |  |  |  |  |
| 108 | RIOT1 | 2 | 23 | 1 | 0 |  |  |  |  |  |  |
| 109 | RIOT2 | 10 | 43 | 3 | 0 |  |  |  |  |  |  |
| 110 | FINALEA | 2 | 14 | 5 | 0 |  |  |  |  |  |  |
| 111 | FINALEB | 32 | 3 | 3 | 0 |  |  |  |  |  |  |
| 112 | FINALEC | 146 | 12 | 7 | 0 |  |  |  |  |  |  |
| 113 | SHRANGE | 11 | 3 | 0 | 0 |  |  |  |  |  |  |
| 114 | GYMLS | 0 | 32 | 0 | 0 |  |  |  |  |  |  |
| 115 | GYMSF | 0 | 32 | 0 | 0 |  |  |  |  |  |  |
| 116 | GYMLV | 0 | 32 | 0 | 0 |  |  |  |  |  |  |
| 117 | TRUCK | 1 | 1 | 5 | 0 |  |  |  |  |  |  |
| 118 | QUARRY | 12 | 1 | 19 | 0 |  |  |  |  |  |  |
| 119 | BOAT | 9 | 15 | 17 | 0 |  |  |  |  |  |  |
| 120 | BSKOOL | 10 | 6 | 2 | 0 |  |  |  |  |  |  |
| 121 | TAXIODD | 7 | 3 | 0 | 0 |  |  |  |  |  |  |
| 122 | AMBULAN | 0 | 1 | 0 | 0 |  |  |  |  |  |  |
| 123 | FIRETRU | 3 | 2 | 0 | 0 |  |  |  |  |  |  |
| 124 | COPCAR | 6 | 1 | 0 | 0 |  |  |  |  |  |  |
| 125 | BURGJB | 14 | 1 | 4 | 0 |  |  |  |  |  |  |
| 126 | FREIGHT | 0 | 3 | 0 | 0 |  |  |  |  |  |  |
| 127 | PIMP | 0 | 5 | 0 | 0 |  |  |  |  |  |  |
| 128 | BLOOD | 5 | 5 | 3 | 0 |  |  |  |  |  |  |
| 129 | KICKSTA | 2 | 20 | 1 | 0 |  |  |  |  |  |  |
| 130 | TRIA | 0 | 1 | 8 | 0 |  |  |  |  |  |  |
| 131 | BCOUR | 9 | 8 | 0 | 0 |  |  |  |  |  |  |
| 132 | MTBIKER | 0 | 4 | 4 | 0 |  |  |  |  |  |  |
| 133 | STUNT | 0 | 3 | 3 | 0 |  |  |  |  |  |  |
| 134 | BUYPRO1 | 15 | 1 | 0 | 0 |  |  |  |  |  |  |

## Next up

The first commands of the census queue that gta-reversed has a reversed handler for (port the function named), then the first with none (research or keep the stand-in):

- **LOAD_MISSION_AUDIO** (silent, 1220 sites, first in MAIN): `ScriptCommands.cpp:48` LoadMissionAudio. adapter lacks loadMissionAudio
- **PLAY_MISSION_AUDIO** (silent, 659 sites, first in MAIN): `ScriptCommands.cpp:64` PlayMissionAudio. adapter lacks playMissionAudio
- **SET_OBJECT_COLLISION** (authored, 211 sites, first in MAIN): `ObjectCommands.cpp:101` SetObjectCollision. handler comments name an authored stand-in
- **GET_RID_OF_PLAYER_PROSTITUTE** (skipped, 1 sites, first in MAIN): `GameCommands.cpp:63` GetRidOfPlayerProstitute. adapter lacks getRidOfPlayerProstitute (skipped: outputs read as none)
- **GET_CHAR_VELOCITY** (skipped, 11 sites, first in player_parachute.scm): `CharacterCommands.cpp:309` GetCharVelocity. adapter lacks pedVelocity (skipped: outputs read as none)
- **SET_CHAR_ROTATION** (stops, 9 sites, first in player_parachute.scm): `CharacterCommands.cpp:339` SetCharRotation. no handler (the thread gives up)
- **SET_CHAR_SAY_SCRIPT** (stops, 179 sites, first in roulette.scm): `CharacterCommands.cpp:3343` SetCharSayScript. no handler (the thread gives up)
- **ENABLE_DISABLED_ATTRACTORS_ON_OBJECT** (stops, 3 sites, first in roulette.scm): `ObjectCommands.cpp:150` EnableDisabledAttractorOnObject. no handler (the thread gives up)
- **ATTACH_CHAR_TO_OBJECT** (authored, 19 sites, first in basketb.scm): `CharacterCommands.cpp:2542` AttachCharToObject. adapter comments name an authored stand-in (attachPedToObject)
- **GET_DEBUG_CAMERA_COORDINATES** (authored, 6 sites, first in basketb.scm): `CameraCommands.cpp:107` GetDebugCameraCoordinates. adapter comments name an authored stand-in (debugCameraSource)
- **GET_DEBUG_CAMERA_POINT_AT** (authored, 5 sites, first in basketb.scm): `CameraCommands.cpp:112` GetDebugCameraPointAt. adapter comments name an authored stand-in (debugCameraSource)
- **IS_PLAYER_IN_POSITION_FOR_CONVERSATION** (skipped, 6 sites, first in dealer.scm): `ConversationCommands.cpp:31` IsPlayerInPositionForConversation. adapter lacks isPlayerInPositionForConversation (skipped: outputs read as none)
- **SET_CHAR_WANTED_BY_POLICE** (authored, 3 sites, first in dealer.scm): `CharacterCommands.cpp:3238` SetCharWantedByPolice. adapter comments name an authored stand-in (setPedWantedByPolice)
- **CAMERA_SET_VECTOR_MOVE** (authored, 190 sites, first in lowr_cont.scm): `CameraCommands.cpp:237` CameraSetVectorMove. handler comments name an authored stand-in
- **POINT_CAMERA_AT_CAR** (authored, 48 sites, first in gf_date.scm): `CameraCommands.cpp:50` PointCameraAtCar. handler comments name an authored stand-in

- CLEAR_MISSION_AUDIO (silent, 1442 sites, first in MAIN; reference absent). adapter lacks clearMissionAudio
- PLAY_MISSION_PASSED_TUNE (silent, 144 sites, first in MAIN; reference absent). dispatch unreversed; follows the routines it reaches; adapter lacks playMissionPassedTune
- SLIDE_OBJECT (silent, 75 sites, first in MAIN; reference absent). dispatch unreversed; follows the routines it reaches; adapter lacks objectBlockedAt
- ACTIVATE_GARAGE (authored, 27 sites, first in MAIN; reference absent). handler comments name an authored stand-in
- CLOSE_GARAGE (authored, 24 sites, first in MAIN; reference absent). handler comments name an authored stand-in
- CHANGE_GARAGE_TYPE (authored, 20 sites, first in MAIN; reference absent). handler comments name an authored stand-in
- IS_GARAGE_OPEN (authored, 18 sites, first in MAIN; reference absent). handler comments name an authored stand-in
- SET_OBJECT_COORDINATES_AND_VELOCITY (skipped, 18 sites, first in MAIN; reference absent). adapter lacks setObjectCoordinatesAndVelocity (skipped: outputs read as none)
- GRAB_ENTITY_ON_ROPE_FOR_OBJECT (skipped, 15 sites, first in MAIN; reference absent). adapter lacks grabEntityOnRopeForObject (skipped: outputs read as none)
- GET_BEAT_PROXIMITY (skipped, 9 sites, first in MAIN; reference absent). adapter lacks beatProximity (skipped: outputs read as none)
- SET_ROPE_HEIGHT_FOR_OBJECT (skipped, 8 sites, first in MAIN; reference absent). adapter lacks setRopeHeightForObject (skipped: outputs read as none)
- RELEASE_ENTITY_FROM_ROPE_FOR_OBJECT (skipped, 7 sites, first in MAIN; reference absent). adapter lacks releaseEntityFromRopeForObject (skipped: outputs read as none)
- ARE_MEASUREMENTS_IN_METRES (authored, 6 sites, first in MAIN; reference absent). adapter comments name an authored stand-in (measurementsAreInMetres)
- GET_CAR_MODEL_VALUE (skipped, 4 sites, first in MAIN; reference absent). adapter lacks getCarModelValue (skipped: outputs read as none)
- GET_CURRENT_CAR_MOD (skipped, 2 sites, first in MAIN; reference absent). adapter lacks getCurrentCarMod (skipped: outputs read as none)
