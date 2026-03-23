/* ═══════════════════════════════════════════════════════════════════
   questions.js — Random BODMAS question generator

   Each "question" contains:
     tokens  : display array for the full expression
     steps   : array of Step objects the user solves one by one

   A Step has:
     correctOpType   : which operation tier to pick
     groups          : all selectable choice objects
     correctGroup    : the one that is correct
     expressionAfter : simplified expression string after this step
     explanation     : educational text
═══════════════════════════════════════════════════════════════════ */

const QuestionGenerator = (() => {

  /* ── BODMAS priority (lower = solve first) ───────────────────── */
  const PRIORITY = {
    bracket:  1,
    power:    2,
    divide:   3,
    multiply: 3,
    add:      4,
    subtract: 4
  };

  const OP_SYMBOLS = {
    divide:   '÷',
    multiply: '×',
    add:      '+',
    subtract: '−'
  };

  const OP_LABELS = {
    bracket:  'Brackets first',
    power:    'Power / Order',
    divide:   'Division',
    multiply: 'Multiplication',
    add:      'Addition',
    subtract: 'Subtraction'
  };

  /* ── Small helpers ────────────────────────────────────────────── */
  const rnd      = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick     = arr        => arr[Math.floor(Math.random() * arr.length)];
  const cloneArr = arr        => arr.map(x => x);

  function compute(a, op, b) {
    switch (op) {
      case 'add':      return a + b;
      case 'subtract': return a - b;
      case 'multiply': return a * b;
      case 'divide':
        // Should only be called when b !== 0 due to sanitise()
        return b !== 0 ? Math.round((a / b) * 100) / 100 : a;
      case 'power':    return Math.pow(a, b);
      default:         return a;
    }
  }

  /** Sanitise: replace any divisor that is 0 with a random 1–9 */
  function sanitise(numbers, opTypes) {
    opTypes.forEach((op, i) => {
      if (op === 'divide' && numbers[i + 1] === 0) {
        numbers[i + 1] = rnd(1, 9);
      }
    });
  }

  /* ── Token builders ───────────────────────────────────────────── */
  const numToken  = v      => ({ type: 'num',      value: v });
  const opToken   = opType => ({ type: 'op',       value: OP_SYMBOLS[opType], opType });
  const brOpen    = ()     => ({ type: 'br_open',  value: '(' });
  const brClose   = ()     => ({ type: 'br_close', value: ')' });

  /* ── opGroup: a selectable choice ────────────────────────────── */
  function opGroup(opType, left, right) {
    return {
      opType,
      left, right,
      result:   compute(left, opType, right),
      display:  `${left} ${OP_SYMBOLS[opType]} ${right}`,
      priority: PRIORITY[opType],
      label:    OP_LABELS[opType]
    };
  }

  /* ── Evaluate a flat list correctly by BODMAS priority ────────── */
  function evaluateFlat(nums, ops) {
    let ns = cloneArr(nums);
    let os = cloneArr(ops);
    while (os.length > 0) {
      const pris = os.map(o => PRIORITY[o]);
      const min  = Math.min(...pris);
      const idx  = pris.indexOf(min); // leftmost of equal priority
      const res  = compute(ns[idx], os[idx], ns[idx + 1]);
      ns = [...ns.slice(0, idx), res, ...ns.slice(idx + 2)];
      os = [...os.slice(0, idx), ...os.slice(idx + 1)];
    }
    return ns[0];
  }

  /* ── Format a flat expression as a string ─────────────────────── */
  function fmtFlat(nums, ops) {
    if (nums.length === 0) return '';
    let s = String(nums[0]);
    ops.forEach((op, i) => { s += ` ${OP_SYMBOLS[op]} ${nums[i + 1]}`; });
    return s;
  }

  /* ══════════════════════════════════════════════════════════════
     STEP BUILDER — flat expression (no brackets, no powers)
     Correctly uses BODMAS priority within the flat list.
  ══════════════════════════════════════════════════════════════ */
  function buildStepsFlat(numbers, opTypes) {
    const steps = [];
    let nums = cloneArr(numbers);
    let ops  = cloneArr(opTypes);

    while (ops.length > 0) {
      const pris   = ops.map(o => PRIORITY[o]);
      const minPri = Math.min(...pris);
      const idx    = pris.indexOf(minPri); // leftmost of equal tier
      const op     = ops[idx];
      const a      = nums[idx];
      const b      = nums[idx + 1];
      const res    = compute(a, op, b);

      const groups       = ops.map((o, i) => opGroup(o, nums[i], nums[i + 1]));
      const correctGroup = groups[idx];
      const explanation  = buildExplanation(op, a, b, res);

      const newNums    = [...nums.slice(0, idx), res, ...nums.slice(idx + 2)];
      const newOps     = [...ops.slice(0, idx),      ...ops.slice(idx + 1)];
      const exprAfter  = newOps.length === 0 ? `= ${res}` : fmtFlat(newNums, newOps);

      steps.push({ correctOpType: op, groups, correctGroup, expressionAfter: exprAfter, explanation });

      nums = newNums;
      ops  = newOps;
    }
    return steps;
  }

  /* ══════════════════════════════════════════════════════════════
     STEP BUILDER — with brackets (and optional power)

     Strategy (clean rewrite):
     1. Resolve all bracket-interior ops by BODMAS priority
     2. Resolve any power token
     3. Resolve remaining flat ops by BODMAS priority
  ══════════════════════════════════════════════════════════════ */
  function buildStepsWithBracket(numbers, opTypes, bStart, bEnd, powerIdx) {
    const steps = [];

    /* ── Phase 1: bracket interior ─────────────────────────────── */
    // Extract inner nums & ops
    const innerNums = numbers.slice(bStart, bEnd + 1); // bEnd inclusive
    const innerOps  = opTypes.slice(bStart, bEnd);     // one less than innerNums

    let bNums = cloneArr(innerNums);
    let bOps  = cloneArr(innerOps);

    while (bOps.length > 0) {
      // BODMAS priority inside the bracket!
      const pris   = bOps.map(o => PRIORITY[o]);
      const minPri = Math.min(...pris);
      const bidx   = pris.indexOf(minPri);
      const bOp    = bOps[bidx];
      const ba     = bNums[bidx];
      const bb     = bNums[bidx + 1];
      const bRes   = compute(ba, bOp, bb);

      // The bracket group shown to user always represents the whole bracket
      const bracketGroup = {
        opType:   'bracket',
        display:  `(${fmtFlat(bNums, bOps)})`,
        result:   evaluateFlat(bNums, bOps),
        priority: 1,
        label:    OP_LABELS['bracket']
      };

      // Outer ops that live outside the bracket (for distractor choices)
      const outerGroups = buildOuterGroups(numbers, opTypes, bStart, bEnd);

      const groups      = [bracketGroup, ...outerGroups];
      const explanation = `Brackets are always solved first (B in BODMAS). Inside the bracket: ${ba} ${OP_SYMBOLS[bOp]} ${bb} = ${bRes}.`;

      // Update inner state
      bNums = [...bNums.slice(0, bidx), bRes, ...bNums.slice(bidx + 2)];
      bOps  = [...bOps.slice(0, bidx), ...bOps.slice(bidx + 1)];

      const bracketResult = bNums[0]; // will equal evaluateFlat when bOps empty
      const exprAfter     = bOps.length === 0
        ? buildFlatAfterBracket(numbers, opTypes, bStart, bEnd, bracketResult, powerIdx)
        : `(${fmtFlat(bNums, bOps)}) — solving bracket step by step`;

      steps.push({ correctOpType: 'bracket', groups, correctGroup: bracketGroup, expressionAfter: exprAfter, explanation });
    }

    // The resolved bracket value
    const bracketValue = evaluateFlat(innerNums, innerOps);

    /* ── Phase 2: collapse bracket into flat array ─────────────── */
    // Build a fresh flat nums/ops excluding the bracket interior
    // flatNums[bStart] = bracketValue, flatNums[bStart+1..bEnd] removed
    let flatNums = [
      ...numbers.slice(0, bStart),
      bracketValue,
      ...numbers.slice(bEnd + 1)
    ];
    // Remove the inner ops; keep outer ops
    let flatOps = [
      ...opTypes.slice(0, bStart),
      ...opTypes.slice(bEnd)   // ops at bEnd and after (the op right after bracket)
    ];

    /* Adjust powerIdx into collapsed coordinate space */
    let adjPowerIdx = -1;
    if (powerIdx >= 0) {
      if (powerIdx < bStart)       adjPowerIdx = powerIdx;
      else if (powerIdx > bEnd)    adjPowerIdx = powerIdx - (bEnd - bStart);
      // if powerIdx was inside bracket we ignore it (shouldn't happen by design)
    }

    /* ── Phase 3: power (if any) ────────────────────────────────── */
    if (adjPowerIdx >= 0) {
      const base = flatNums[adjPowerIdx];
      const exp  = 2;
      const res  = Math.pow(base, exp);

      const powerGroup = {
        opType: 'power',
        display: `${base}²`,
        result:  res,
        priority: PRIORITY.power,
        label:    OP_LABELS.power
      };

      const otherGroups = flatOps.map((o, i) => opGroup(o, flatNums[i], flatNums[i + 1]));
      const groups      = [powerGroup, ...otherGroups];
      const explanation = `Orders/Exponents (O in BODMAS) come after brackets. ${base}² = ${res}.`;

      flatNums[adjPowerIdx] = res;

      const exprAfter = fmtFlat(flatNums, flatOps) || `= ${res}`;
      steps.push({ correctOpType: 'power', groups, correctGroup: powerGroup, expressionAfter: exprAfter, explanation });
    }

    /* ── Phase 4: remaining flat ops ────────────────────────────── */
    const remainSteps = buildStepsFlat(flatNums, flatOps);
    steps.push(...remainSteps);

    return steps;
  }

  /** Build outer (non-bracket) opGroups for distractor choices */
  function buildOuterGroups(numbers, opTypes, bStart, bEnd) {
    const groups = [];
    opTypes.forEach((op, i) => {
      if (i < bStart || i >= bEnd) {
        groups.push(opGroup(op, numbers[i], numbers[i + 1]));
      }
    });
    return groups;
  }

  /** Build the expression string shown after bracket is fully resolved */
  function buildFlatAfterBracket(numbers, opTypes, bStart, bEnd, bracketValue, powerIdx) {
    const nums = [
      ...numbers.slice(0, bStart),
      bracketValue,
      ...numbers.slice(bEnd + 1)
    ];
    const ops = [
      ...opTypes.slice(0, bStart),
      ...opTypes.slice(bEnd)
    ];
    // Add power superscript notation if relevant
    const display = fmtFlat(nums, ops);
    return display || `= ${bracketValue}`;
  }

  /* ── Explanation sentences ────────────────────────────────────── */
  function buildExplanation(opType, a, b, result) {
    const sym  = OP_SYMBOLS[opType] || opType;
    const rules = {
      bracket:  'Brackets are always solved first (B in BODMAS).',
      power:    'Orders/Exponents (O in BODMAS) come after brackets.',
      divide:   'Division comes before addition and subtraction (D before A/S in BODMAS).',
      multiply: 'Multiplication comes before addition and subtraction (M before A/S in BODMAS). When ÷ and × both appear, solve left to right.',
      add:      'Addition is solved after all higher-priority operations are done.',
      subtract: 'Subtraction is solved last (with addition, left to right).'
    };
    return `${rules[opType] || ''} So we evaluate ${a} ${sym} ${b} = ${result} next.`;
  }

  /* ══════════════════════════════════════════════════════════════
     GENERATORS
  ══════════════════════════════════════════════════════════════ */

  /* EASY: 2–3 flat ops, no brackets, no powers */
  function generateEasy() {
    const allOps  = ['add', 'subtract', 'multiply', 'divide'];
    const numOps  = rnd(2, 3);
    const numbers = Array.from({ length: numOps + 1 }, () => rnd(1, 12));
    const opTypes = Array.from({ length: numOps }, () => pick(allOps));
    sanitise(numbers, opTypes);

    // Ensure at least 2 distinct priority tiers to make it interesting
    const hasMixed = opTypes.some(o => PRIORITY[o] <= 3) && opTypes.some(o => PRIORITY[o] >= 4);
    if (!hasMixed && numOps >= 2) {
      opTypes[0] = pick(['multiply', 'divide']);
      opTypes[1] = pick(['add', 'subtract']);
    }
    sanitise(numbers, opTypes);

    const tokens = [];
    numbers.forEach((n, i) => {
      tokens.push(numToken(n));
      if (i < opTypes.length) tokens.push(opToken(opTypes[i]));
    });

    return { tokens, steps: buildStepsFlat(numbers, opTypes), level: 'easy' };
  }

  /* MEDIUM: 3–4 ops, brackets sometimes */
  function generateMedium() {
    if (Math.random() > 0.35) return makeWithBrackets(rnd(3, 4), false);
    return makeFlat(rnd(3, 4));
  }

  /* HARD: 4–5 ops, brackets always, powers sometimes */
  function generateHard() {
    return makeWithBrackets(rnd(4, 5), Math.random() > 0.4);
  }

  function makeFlat(numOps) {
    const allOps  = ['add', 'subtract', 'multiply', 'divide'];
    const numbers = Array.from({ length: numOps + 1 }, () => rnd(1, 15));
    const opTypes = Array.from({ length: numOps }, () => pick(allOps));
    sanitise(numbers, opTypes);
    const tokens = [];
    numbers.forEach((n, i) => {
      tokens.push(numToken(n));
      if (i < opTypes.length) tokens.push(opToken(opTypes[i]));
    });
    return { tokens, steps: buildStepsFlat(numbers, opTypes), level: 'medium' };
  }

  function makeWithBrackets(numOps, includePower) {
    /* Choose bracket span (covers at least 2 numbers = 1 inner op) */
    const innerLen  = rnd(2, Math.min(numOps, 3));
    const bStart    = rnd(0, numOps - innerLen);      // first number inside bracket
    const bEnd      = bStart + innerLen - 1;          // last number inside bracket
    // ops inside bracket: opTypes[bStart .. bEnd-1]

    const allOps  = ['add', 'subtract', 'multiply', 'divide'];
    const numbers = Array.from({ length: numOps + 1 }, () => rnd(1, 10));
    const opTypes = Array.from({ length: numOps }, () => pick(allOps));
    sanitise(numbers, opTypes);

    // Ensure interesting BODMAS inside the bracket (mix priorities)
    const innerOpsCount = bEnd - bStart;           // number of ops inside bracket
    if (innerOpsCount >= 2) {
      opTypes[bStart]     = pick(['multiply', 'divide']);
      opTypes[bStart + 1] = pick(['add', 'subtract']);
    }
    sanitise(numbers, opTypes);

    /* Optional power — on a number outside the bracket */
    let powerIdx = -1;
    if (includePower) {
      const outerNums = [];
      for (let i = 0; i <= numOps; i++) {
        if (i < bStart || i > bEnd) outerNums.push(i);
      }
      if (outerNums.length > 0) {
        powerIdx = pick(outerNums);
        numbers[powerIdx] = rnd(2, 4);
      }
    }

    /* Build token array */
    const tokens = [];
    for (let i = 0; i < numbers.length; i++) {
      if (i === bStart) tokens.push(brOpen());
      if (powerIdx === i) {
        const exp = rnd(2, 3);
        tokens.push({ type: 'power', value: `${numbers[i]}`, exp, opType: 'power' });
      } else {
        tokens.push(numToken(numbers[i]));
      }
      if (i === bEnd) tokens.push(brClose());
      if (i < opTypes.length) tokens.push(opToken(opTypes[i]));
    }

    const steps = buildStepsWithBracket(numbers, opTypes, bStart, bEnd, powerIdx);
    return { tokens, steps, level: includePower ? 'hard' : 'medium' };
  }

  /* ── Public API ──────────────────────────────────────────────── */
  function generate(level) {
    try {
      switch (level) {
        case 'easy':   return generateEasy();
        case 'medium': return generateMedium();
        case 'hard':   return generateHard();
        default:       return generateEasy();
      }
    } catch (e) {
      // Safety fallback: generate a simple easy question
      console.warn('Question generator error, using fallback:', e);
      return generateEasy();
    }
  }

  return { generate, PRIORITY, OP_SYMBOLS, OP_LABELS };
})();
