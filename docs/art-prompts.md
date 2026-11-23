# Промпты для портретов героев и войск

Сгенерированные картинки кладите в `public/img/figures/<id>.png`, где `<id>` взят из заголовка ниже
(например `public/img/figures/dawn_paladin.png`). Формат: квадрат, PNG, лучше 512×512.
Пока файла нет, в игре рисуется временная SVG-фигурка; как только файл появится, он заменит её сам, код менять не нужно.

Общий стиль (уже добавлен в каждый промпт):

> Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.

Герои: портрет по пояс. Войска: фигура целиком, чтобы читалась на маленькой плитке.

## Орден Рассвета

Внешний вид фракции: a human knightly kingdom; polished steel, blue and gold heraldry with a rising-sun emblem, white cloaks.

### Герои

#### `dawn_paladin` — Паладин

```text
Half-body portrait of a hero of a human knightly kingdom; polished steel, blue and gold heraldry with a rising-sun emblem, white cloaks. Hero: Паладин, Щит ордена — Ведёт рыцарей в первом ряду, лечит и защищает войска. Signature relic: Клинок Зари. Confident heroic pose, facing slightly left. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `dawn_archmage` — Архимаг

```text
Half-body portrait of a hero of a human knightly kingdom; polished steel, blue and gold heraldry with a rising-sun emblem, white cloaks. Hero: Архимаг, Хранитель башни — Сильнейший заклинатель ордена, усиливает магов. Signature relic: Посох Семи Звёзд. Confident heroic pose, facing slightly left. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `dawn_marshal` — Маршал

```text
Half-body portrait of a hero of a human knightly kingdom; polished steel, blue and gold heraldry with a rising-sun emblem, white cloaks. Hero: Маршал, Командир стрелков — Мастер строя и залпов, ведёт арбалетчиков. Signature relic: Знамя Первого Полка. Confident heroic pose, facing slightly left. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `dawn_inquisitor` — Инквизитор

```text
Half-body portrait of a hero of a human knightly kingdom; polished steel, blue and gold heraldry with a rising-sun emblem, white cloaks. Hero: Инквизитор, Карающая длань — Охотник на нечисть, ослабляет вражескую магию. Signature relic: Печать Очищения. Confident heroic pose, facing slightly left. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

### Войска

#### `dawn_militia` — Ополченец (ступень 1)

```text
Full-body figure of a tier 1 of 7 unit (melee fighter) of a human knightly kingdom; polished steel, blue and gold heraldry with a rising-sun emblem, white cloaks. Unit: Ополченец — Дешёвая пехота с копьём. Simple, common soldier look. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `dawn_halberdier` — Алебардщик (ступень 1)

```text
Full-body figure of a tier 1 of 7 unit (melee fighter) of a human knightly kingdom; polished steel, blue and gold heraldry with a rising-sun emblem, white cloaks. Unit: Алебардщик — Медленнее, но крепче, держит строй. Simple, common soldier look. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `dawn_crossbow` — Арбалетчик (ступень 2)

```text
Full-body figure of a tier 2 of 7 unit (ranged shooter) of a human knightly kingdom; polished steel, blue and gold heraldry with a rising-sun emblem, white cloaks. Unit: Арбалетчик — Стреляет издалека, бьёт сквозь броню. Simple, common soldier look. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `dawn_archer` — Лучник (ступень 2)

```text
Full-body figure of a tier 2 of 7 unit (ranged shooter) of a human knightly kingdom; polished steel, blue and gold heraldry with a rising-sun emblem, white cloaks. Unit: Лучник — Быстрые выстрелы, слабее в ближнем бою. Simple, common soldier look. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `dawn_sister` — Сестра милосердия (ступень 3)

```text
Full-body figure of a tier 3 of 7 unit (spellcaster) of a human knightly kingdom; polished steel, blue and gold heraldry with a rising-sun emblem, white cloaks. Unit: Сестра милосердия — Лечит отряды рядом с собой. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `dawn_battlemage` — Боевой маг (ступень 3)

```text
Full-body figure of a tier 3 of 7 unit (spellcaster) of a human knightly kingdom; polished steel, blue and gold heraldry with a rising-sun emblem, white cloaks. Unit: Боевой маг — Бросает огненные шары. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `dawn_griffin` — Грифон (ступень 4)

```text
Full-body figure of a tier 4 of 7 unit (flying creature) of a human knightly kingdom; polished steel, blue and gold heraldry with a rising-sun emblem, white cloaks. Unit: Грифон — Летает и отвечает на каждую атаку. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `dawn_pegasus` — Пегас (ступень 4)

```text
Full-body figure of a tier 4 of 7 unit (flying creature) of a human knightly kingdom; polished steel, blue and gold heraldry with a rising-sun emblem, white cloaks. Unit: Пегас — Самый быстрый отряд ордена. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `dawn_knight` — Рыцарь (ступень 5)

```text
Full-body figure of a tier 5 of 7 unit (melee fighter) of a human knightly kingdom; polished steel, blue and gold heraldry with a rising-sun emblem, white cloaks. Unit: Рыцарь — Тяжёлая конница, удар с разбега. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `dawn_cuirassier` — Кирасир (ступень 5)

```text
Full-body figure of a tier 5 of 7 unit (melee fighter) of a human knightly kingdom; polished steel, blue and gold heraldry with a rising-sun emblem, white cloaks. Unit: Кирасир — Медленнее рыцаря, но в два слоя брони. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `dawn_trebuchet` — Требушет (ступень 6)

```text
Full-body figure of a tier 6 of 7 unit (siege engine) of a human knightly kingdom; polished steel, blue and gold heraldry with a rising-sun emblem, white cloaks. Unit: Требушет — Бьёт по площади через всё поле. Huge and imposing. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `dawn_ballista` — Баллиста (ступень 6)

```text
Full-body figure of a tier 6 of 7 unit (siege engine) of a human knightly kingdom; polished steel, blue and gold heraldry with a rising-sun emblem, white cloaks. Unit: Баллиста — Точный выстрел по одной цели. Huge and imposing. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `dawn_guardian` — Небесный страж (ступень 7)

```text
Full-body figure of a tier 7 of 7 unit (flying creature) of a human knightly kingdom; polished steel, blue and gold heraldry with a rising-sun emblem, white cloaks. Unit: Небесный страж — Крылатый воин, воскрешает павших. Huge and imposing. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `dawn_seraph` — Серафим (ступень 7)

```text
Full-body figure of a tier 7 of 7 unit (spellcaster) of a human knightly kingdom; polished steel, blue and gold heraldry with a rising-sun emblem, white cloaks. Unit: Серафим — Выжигает нечисть светом. Huge and imposing. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

## Кланы Пепла

Внешний вид фракции: human steppe barbarian clans and ogres (no orcs, no green skin); crimson and ember-orange colors, furs, bone trophies, ash-grey war paint.

### Герои

#### `ash_warlord` — Вождь

```text
Half-body portrait of a hero of human steppe barbarian clans and ogres (no orcs, no green skin); crimson and ember-orange colors, furs, bone trophies, ash-grey war paint. Hero: Вождь, Голос кланов — Ведёт орду в атаку, усиливает ближний бой. Signature relic: Топор Первого Костра. Confident heroic pose, facing slightly left. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `ash_shaman` — Шаман бури

```text
Half-body portrait of a hero of human steppe barbarian clans and ogres (no orcs, no green skin); crimson and ember-orange colors, furs, bone trophies, ash-grey war paint. Hero: Шаман бури, Говорящий с громом — Призывает молнии и лечит воинов. Signature relic: Тотем Грома. Confident heroic pose, facing slightly left. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `ash_beastmaster` — Укротитель

```text
Half-body portrait of a hero of human steppe barbarian clans and ogres (no orcs, no green skin); crimson and ember-orange colors, furs, bone trophies, ash-grey war paint. Hero: Укротитель, Брат зверей — Ездит на волке, ведёт зверей и всадников. Signature relic: Клык Старого Волка. Confident heroic pose, facing slightly left. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `ash_berserker` — Берсерк

```text
Half-body portrait of a hero of human steppe barbarian clans and ogres (no orcs, no green skin); crimson and ember-orange colors, furs, bone trophies, ash-grey war paint. Hero: Берсерк, Красная ярость — Чем меньше здоровья, тем сильнее бьёт. Signature relic: Цепной молот. Confident heroic pose, facing slightly left. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

### Войска

#### `ash_raider` — Налётчик (ступень 1)

```text
Full-body figure of a tier 1 of 7 unit (melee fighter) of human steppe barbarian clans and ogres (no orcs, no green skin); crimson and ember-orange colors, furs, bone trophies, ash-grey war paint. Unit: Налётчик — Быстрый и злой, но слабо защищён. Simple, common soldier look. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `ash_brute` — Рубака (ступень 1)

```text
Full-body figure of a tier 1 of 7 unit (melee fighter) of human steppe barbarian clans and ogres (no orcs, no green skin); crimson and ember-orange colors, furs, bone trophies, ash-grey war paint. Unit: Рубака — Крепче налётчика, со щитом. Simple, common soldier look. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `ash_axethrower` — Метатель топоров (ступень 2)

```text
Full-body figure of a tier 2 of 7 unit (ranged shooter) of human steppe barbarian clans and ogres (no orcs, no green skin); crimson and ember-orange colors, furs, bone trophies, ash-grey war paint. Unit: Метатель топоров — Метает топоры, хорош и вблизи. Simple, common soldier look. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `ash_slinger` — Пращник (ступень 2)

```text
Full-body figure of a tier 2 of 7 unit (ranged shooter) of human steppe barbarian clans and ogres (no orcs, no green skin); crimson and ember-orange colors, furs, bone trophies, ash-grey war paint. Unit: Пращник — Бьёт дальше, но слабее. Simple, common soldier look. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `ash_witchdoctor` — Знахарь (ступень 3)

```text
Full-body figure of a tier 3 of 7 unit (spellcaster) of human steppe barbarian clans and ogres (no orcs, no green skin); crimson and ember-orange colors, furs, bone trophies, ash-grey war paint. Unit: Знахарь — Лечит и проклинает врагов. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `ash_totemist` — Тотемщик (ступень 3)

```text
Full-body figure of a tier 3 of 7 unit (spellcaster) of human steppe barbarian clans and ogres (no orcs, no green skin); crimson and ember-orange colors, furs, bone trophies, ash-grey war paint. Unit: Тотемщик — Ставит тотемы, усиливающие своих. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `ash_wolfrider` — Волчий всадник (ступень 4)

```text
Full-body figure of a tier 4 of 7 unit (melee fighter) of human steppe barbarian clans and ogres (no orcs, no green skin); crimson and ember-orange colors, furs, bone trophies, ash-grey war paint. Unit: Волчий всадник — Быстрый всадник, бьёт и отходит. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `ash_boarrider` — Наездник на вепре (ступень 4)

```text
Full-body figure of a tier 4 of 7 unit (melee fighter) of human steppe barbarian clans and ogres (no orcs, no green skin); crimson and ember-orange colors, furs, bone trophies, ash-grey war paint. Unit: Наездник на вепре — Медленнее, но сносит строй. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `ash_ogre` — Огр-громила (ступень 5)

```text
Full-body figure of a tier 5 of 7 unit (melee fighter) of human steppe barbarian clans and ogres (no orcs, no green skin); crimson and ember-orange colors, furs, bone trophies, ash-grey war paint. Unit: Огр-громила — Огромный, много здоровья. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `ash_ogremage` — Огр-чародей (ступень 5)

```text
Full-body figure of a tier 5 of 7 unit (spellcaster) of human steppe barbarian clans and ogres (no orcs, no green skin); crimson and ember-orange colors, furs, bone trophies, ash-grey war paint. Unit: Огр-чародей — Огр, выучивший пару заклинаний. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `ash_catapult` — Камнемёт (ступень 6)

```text
Full-body figure of a tier 6 of 7 unit (siege engine) of human steppe barbarian clans and ogres (no orcs, no green skin); crimson and ember-orange colors, furs, bone trophies, ash-grey war paint. Unit: Камнемёт — Бросает камни через поле. Huge and imposing. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `ash_ram` — Таран (ступень 6)

```text
Full-body figure of a tier 6 of 7 unit (siege engine) of human steppe barbarian clans and ogres (no orcs, no green skin); crimson and ember-orange colors, furs, bone trophies, ash-grey war paint. Unit: Таран — Медленно едет и крушит всё перед собой. Huge and imposing. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `ash_wyvern` — Виверна (ступень 7)

```text
Full-body figure of a tier 7 of 7 unit (flying creature) of human steppe barbarian clans and ogres (no orcs, no green skin); crimson and ember-orange colors, furs, bone trophies, ash-grey war paint. Unit: Виверна — Летучий ящер с ядовитым хвостом. Huge and imposing. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `ash_mammoth` — Боевой мамонт (ступень 7)

```text
Full-body figure of a tier 7 of 7 unit (melee fighter) of human steppe barbarian clans and ogres (no orcs, no green skin); crimson and ember-orange colors, furs, bone trophies, ash-grey war paint. Unit: Боевой мамонт — Живая крепость с наездниками. Huge and imposing. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

## Ковен Тлена

Внешний вид фракции: an undead necromancer coven; bone, tattered black and violet cloth, sickly green magic glow.

### Герои

#### `rot_necromancer` — Некромант

```text
Half-body portrait of a hero of an undead necromancer coven; bone, tattered black and violet cloth, sickly green magic glow. Hero: Некромант, Собиратель душ — Поднимает павших врагов в армию. Signature relic: Череп Шёпотов. Confident heroic pose, facing slightly left. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `rot_deathknight` — Рыцарь тлена

```text
Half-body portrait of a hero of an undead necromancer coven; bone, tattered black and violet cloth, sickly green magic glow. Hero: Рыцарь тлена, Чёрный клинок — Мёртвый рыцарь, ведёт конницу мертвецов. Signature relic: Хладный меч. Confident heroic pose, facing slightly left. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `rot_lich` — Костяной лорд

```text
Half-body portrait of a hero of an undead necromancer coven; bone, tattered black and violet cloth, sickly green magic glow. Hero: Костяной лорд, Неумирающий — Древний маг, его проклятия ослабляют врага. Signature relic: Филактерия. Confident heroic pose, facing slightly left. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `rot_vampire` — Вампирша

```text
Half-body portrait of a hero of an undead necromancer coven; bone, tattered black and violet cloth, sickly green magic glow. Hero: Вампирша, Госпожа крови — Пьёт жизнь врагов и лечит свои отряды. Signature relic: Кубок Алой Ночи. Confident heroic pose, facing slightly left. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

### Войска

#### `rot_skeleton` — Скелет (ступень 1)

```text
Full-body figure of a tier 1 of 7 unit (melee fighter) of an undead necromancer coven; bone, tattered black and violet cloth, sickly green magic glow. Unit: Скелет — Дешёвый, не чувствует страха. Simple, common soldier look. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `rot_ghoul` — Гуль (ступень 1)

```text
Full-body figure of a tier 1 of 7 unit (melee fighter) of an undead necromancer coven; bone, tattered black and violet cloth, sickly green magic glow. Unit: Гуль — Быстрый, раны заживают поеданием павших. Simple, common soldier look. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `rot_skelarcher` — Скелет-лучник (ступень 2)

```text
Full-body figure of a tier 2 of 7 unit (ranged shooter) of an undead necromancer coven; bone, tattered black and violet cloth, sickly green magic glow. Unit: Скелет-лучник — Стреляет костяными стрелами. Simple, common soldier look. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `rot_spitter` — Чумной плевун (ступень 2)

```text
Full-body figure of a tier 2 of 7 unit (ranged shooter) of an undead necromancer coven; bone, tattered black and violet cloth, sickly green magic glow. Unit: Чумной плевун — Плюётся ядом, ослабляя броню. Simple, common soldier look. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `rot_wraith` — Призрак (ступень 3)

```text
Full-body figure of a tier 3 of 7 unit (flying creature) of an undead necromancer coven; bone, tattered black and violet cloth, sickly green magic glow. Unit: Призрак — Проходит сквозь врагов, трудно попасть. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `rot_banshee` — Банши (ступень 3)

```text
Full-body figure of a tier 3 of 7 unit (spellcaster) of an undead necromancer coven; bone, tattered black and violet cloth, sickly green magic glow. Unit: Банши — Крик снижает боевой дух врагов. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `rot_gargoyle` — Горгулья (ступень 4)

```text
Full-body figure of a tier 4 of 7 unit (flying creature) of an undead necromancer coven; bone, tattered black and violet cloth, sickly green magic glow. Unit: Горгулья — Каменная, почти не боится магии. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `rot_bat` — Нетопырь (ступень 4)

```text
Full-body figure of a tier 4 of 7 unit (flying creature) of an undead necromancer coven; bone, tattered black and violet cloth, sickly green magic glow. Unit: Нетопырь — Пьёт кровь и возвращается. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `rot_abomination` — Мясной голем (ступень 5)

```text
Full-body figure of a tier 5 of 7 unit (melee fighter) of an undead necromancer coven; bone, tattered black and violet cloth, sickly green magic glow. Unit: Мясной голем — Сшит из павших, огромный запас здоровья. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `rot_deadrider` — Всадник-мертвец (ступень 5)

```text
Full-body figure of a tier 5 of 7 unit (melee fighter) of an undead necromancer coven; bone, tattered black and violet cloth, sickly green magic glow. Unit: Всадник-мертвец — Конница мёртвых, вселяет ужас. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `rot_bonecatapult` — Костемёт (ступень 6)

```text
Full-body figure of a tier 6 of 7 unit (siege engine) of an undead necromancer coven; bone, tattered black and violet cloth, sickly green magic glow. Unit: Костемёт — Метает черепа, заражая врагов. Huge and imposing. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `rot_plaguecart` — Чумная телега (ступень 6)

```text
Full-body figure of a tier 6 of 7 unit (siege engine) of an undead necromancer coven; bone, tattered black and violet cloth, sickly green magic glow. Unit: Чумная телега — Оставляет ядовитое облако. Huge and imposing. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `rot_bonedragon` — Костяной дракон (ступень 7)

```text
Full-body figure of a tier 7 of 7 unit (flying creature) of an undead necromancer coven; bone, tattered black and violet cloth, sickly green magic glow. Unit: Костяной дракон — Скелет древнего дракона. Huge and imposing. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `rot_reaper` — Тёмный жнец (ступень 7)

```text
Full-body figure of a tier 7 of 7 unit (melee fighter) of an undead necromancer coven; bone, tattered black and violet cloth, sickly green magic glow. Unit: Тёмный жнец — Каждый удар может убить сразу несколько существ. Huge and imposing. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

## Лесной Круг

Внешний вид фракции: elven forest wardens and nature spirits; living bark, leaves, antlers, deep green with moonlit violet accents.

### Герои

#### `grove_druid` — Верховный друид

```text
Half-body portrait of a hero of elven forest wardens and nature spirits; living bark, leaves, antlers, deep green with moonlit violet accents. Hero: Верховный друид, Голос леса — Превращается в зверя и лечит армию. Signature relic: Посох Первого Дуба. Confident heroic pose, facing slightly left. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `grove_huntress` — Охотница

```text
Half-body portrait of a hero of elven forest wardens and nature spirits; living bark, leaves, antlers, deep green with moonlit violet accents. Hero: Охотница, Тень опушки — Лучшая лучница леса, ведёт стрелков. Signature relic: Лук Лунного Серпа. Confident heroic pose, facing slightly left. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `grove_warden` — Страж рощи

```text
Half-body portrait of a hero of elven forest wardens and nature spirits; living bark, leaves, antlers, deep green with moonlit violet accents. Hero: Страж рощи, Шипы и кора — Танк леса, отражает урон обратно. Signature relic: Кора Древня. Confident heroic pose, facing slightly left. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `grove_moonpriestess` — Жрица луны

```text
Half-body portrait of a hero of elven forest wardens and nature spirits; living bark, leaves, antlers, deep green with moonlit violet accents. Hero: Жрица луны, Серебряный свет — Магия луны и звёзд, усиливает фей. Signature relic: Лунный венец. Confident heroic pose, facing slightly left. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

### Войска

#### `grove_tracker` — Следопыт (ступень 1)

```text
Full-body figure of a tier 1 of 7 unit (melee fighter) of elven forest wardens and nature spirits; living bark, leaves, antlers, deep green with moonlit violet accents. Unit: Следопыт — Лёгкий боец с клинками, бьёт первым. Simple, common soldier look. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `grove_sprite` — Лесной дух (ступень 1)

```text
Full-body figure of a tier 1 of 7 unit (flying creature) of elven forest wardens and nature spirits; living bark, leaves, antlers, deep green with moonlit violet accents. Unit: Лесной дух — Маленький, быстрый и хрупкий. Simple, common soldier look. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `grove_archer` — Лучница (ступень 2)

```text
Full-body figure of a tier 2 of 7 unit (ranged shooter) of elven forest wardens and nature spirits; living bark, leaves, antlers, deep green with moonlit violet accents. Unit: Лучница — Два выстрела за ход. Simple, common soldier look. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `grove_panther` — Боевая пантера (ступень 2)

```text
Full-body figure of a tier 2 of 7 unit (melee fighter) of elven forest wardens and nature spirits; living bark, leaves, antlers, deep green with moonlit violet accents. Unit: Боевая пантера — Прыгает к стрелкам врага. Simple, common soldier look. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `grove_dryad` — Дриада (ступень 3)

```text
Full-body figure of a tier 3 of 7 unit (spellcaster) of elven forest wardens and nature spirits; living bark, leaves, antlers, deep green with moonlit violet accents. Unit: Дриада — Опутывает врага корнями. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `grove_fairy` — Фея (ступень 3)

```text
Full-body figure of a tier 3 of 7 unit (spellcaster) of elven forest wardens and nature spirits; living bark, leaves, antlers, deep green with moonlit violet accents. Unit: Фея — Лечит и усыпляет. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `grove_hippogryph` — Наездница гиппогрифа (ступень 4)

```text
Full-body figure of a tier 4 of 7 unit (flying creature) of elven forest wardens and nature spirits; living bark, leaves, antlers, deep green with moonlit violet accents. Unit: Наездница гиппогрифа — Летает над полем и бьёт сверху. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `grove_bear` — Медведь-оборотень (ступень 4)

```text
Full-body figure of a tier 4 of 7 unit (melee fighter) of elven forest wardens and nature spirits; living bark, leaves, antlers, deep green with moonlit violet accents. Unit: Медведь-оборотень — Друид в облике медведя. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `grove_unicorn` — Единорог (ступень 5)

```text
Full-body figure of a tier 5 of 7 unit (melee fighter) of elven forest wardens and nature spirits; living bark, leaves, antlers, deep green with moonlit violet accents. Unit: Единорог — Слепит врага сиянием рога. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `grove_stag` — Звёздный олень (ступень 5)

```text
Full-body figure of a tier 5 of 7 unit (spellcaster) of elven forest wardens and nature spirits; living bark, leaves, antlers, deep green with moonlit violet accents. Unit: Звёздный олень — Рога светятся и лечат отряды рядом. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `grove_treant` — Древень (ступень 6)

```text
Full-body figure of a tier 6 of 7 unit (melee fighter) of elven forest wardens and nature spirits; living bark, leaves, antlers, deep green with moonlit violet accents. Unit: Древень — Живое дерево, держит удар. Huge and imposing. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `grove_rootthrower` — Корнеплёт (ступень 6)

```text
Full-body figure of a tier 6 of 7 unit (siege engine) of elven forest wardens and nature spirits; living bark, leaves, antlers, deep green with moonlit violet accents. Unit: Корнеплёт — Метает валуны, опутанные корнями. Huge and imposing. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `grove_giant` — Лесной великан (ступень 7)

```text
Full-body figure of a tier 7 of 7 unit (melee fighter) of elven forest wardens and nature spirits; living bark, leaves, antlers, deep green with moonlit violet accents. Unit: Лесной великан — Каменная кожа и дубина-бревно. Huge and imposing. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

#### `grove_dragon` — Изумрудный дракон (ступень 7)

```text
Full-body figure of a tier 7 of 7 unit (flying creature) of elven forest wardens and nature spirits; living bark, leaves, antlers, deep green with moonlit violet accents. Unit: Изумрудный дракон — Дыхание погружает врагов в сон. Huge and imposing. Square 1:1 game portrait for a dark-fantasy browser strategy game, painted digital art, rich detail, dramatic rim light, plain dark background with a soft glow in the faction color. No text, no logo, no frame, no border. Original design, not based on any existing game, film or book character.
```

