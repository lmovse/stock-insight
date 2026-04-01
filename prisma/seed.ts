import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================
// 策略1：均线多头排列基础筛选
// ============================================
const maPromptsContent = `你是股票技术分析师。请根据以下K线数据，判断股票是否满足「均线多头排列」的基础条件。

## 均线系统条件
1. 5日、10日、20日、30日均线呈多头排列（从小到大向上发散）
2. 均线角度向上，短期均线上穿长期均线形成金叉
3. 120日均线走平或向上

## 数据格式
- 股票代码：{{stockCode}}
- 日期区间：{{dateRange}}
- K线数据（OHLCV）：{{klineData}}

## 判断标准
请分析K线数据，判断该股票是否满足均线多头排列条件。

请返回：
结果：符合/不符合
原因：详细说明各项条件是否符合`;

// ============================================
// 策略2：底部形态识别
// ============================================
const bottomPatternContent = `你是股票技术分析师。请根据以下K线数据，判断股票是否形成经典底部形态。

## 底部形态识别标准
1. 平底：连续3-5天收盘价相近，波动幅度小于5%
2. 双底（W底）：两个相近的低点，中间有明显的反弹
3. 圆弧底：低点逐步抬高，形成圆弧形状
4. 头肩底：左肩、右肩、低点依次出现
5. 底部持续时间：通常需要60天以上

## 辅助判断
- 突破颈线时成交量是否放大
- 突破后是否有回踩确认

## 数据格式
- 股票代码：{{stockCode}}
- 日期区间：{{dateRange}}
- K线数据（OHLCV）：{{klineData}}

## 判断标准
请分析K线数据，判断该股票是否形成有效底部形态。

请返回：
结果：符合/不符合
原因：详细说明底部形态类型及是否符合标准`;

// ============================================
// 策略3：量能异动检测
// ============================================
const volumeSignalContent = `你是股票技术分析师。请根据以下K线数据，判断股票是否出现量能异动信号。

## 量能异动类型
1. **倍量阳线**：成交量为前一日的1.5倍以上，且股价上涨
2. **量能堆**：连续3天及以上成交量明显放大
3. **量能三阳**：连续三天放量上涨
4. **缩量回调**：上涨后成交量萎缩至常量一半以下

## 判断标准
- 异动是否发生在关键位置（突破点、回踩点）
- 量能放大是否有持续性
- 是否配合价格形态

## 数据格式
- 股票代码：{{stockCode}}
- 日期区间：{{dateRange}}
- K线数据（OHLCV）：{{klineData}}

## 判断标准
请分析K线数据，判断该股票是否出现有效量能异动信号。

请返回：
结果：符合/不符合
原因：详细说明量能异动类型及是否符合标准`;

// ============================================
// 策略4：四线开花模型之倍量颈线买点（完整版）
// ============================================
const siXianContent = `你是股票策略分析师。请根据以下K线数据，判断股票是否符合「四线开花模型之倍量颈线买点」策略要求。

## 策略技术要领

**一、均线系统条件**
1. 20、30、60、120日均线多头排列
2. 5日、10日线在30日线上方
3. 120日线向上

**二、走势形态要求**
1. 历史上升走势流畅，淘汰过大幅度波动（其中二个以上小波段震幅达25%以上）的震荡上升形态
2. 走势越凌厉越好（涨时连阳拉升，中大阳线超过3-5天，或中小阳线超过5-8天）

**三、底部形态**
1. 较长周期（通常180天以上）显示经典底部形态（平底、双底、圆弧底、头肩底、复合头肩底等）
2. 已突破或接近大底的主颈线位置，呈现即将突破形态
3. 处于大一浪上升和大二浪调整完成后的新升浪中，存在三浪主升的可能

**四、量能要求**
1. 前期较长周期上涨形态中，较之此前长周期下跌大波段有明显放量
2. 有量能堆或量能三阳形态

**五、最近上升波段（一浪）特征**
1. 出现过单日7%以上（最好有涨停板）的放量大阳线
2. 上升支撑线角度大于30度
3. 呈现放量（大于常量150%以上）上涨
4. 最好有过量能堆，或出现过一次以上量能三阳形态

**六、回调形态（量能坑）**
1. 对应最近上涨波段（一浪），回调时有明显缩量的量能坑
2. 调整最好是平台型，最大震幅在25%以内（密集交易区震幅最好在10-15%之间）
3. 也可以是其他回调形态：深V型、三角形、W型、旗形等
4. 调整周期最好是最近上涨波段周期的1/3以内或2/3以上天数，越短或越长越好

**七、买入点确认（核心）**
1. 最近上升小波段（13-34天）反弹至回调波段的35%以上（60%-105%时更好）
2. 出现倍量（成交量为前一日的90%-150%）或量能三阳
3. 此时最好是上升小波段后的平台整理阶段（平台震幅应小于15%）

**八、"倍量颈线"买点**
- 在四线开花模型要素基础上对买点进行修正和完善
- 未出现四线开花模型的突破买点时，出现"未突破但达到颈线，且成交量为前一日倍量"的买点
- 孕育四线开花模型（T-3至T+8日全面多头排列）
- 若未来5-8天出现四线开花模型则按四线开花模型二次加仓追买

## 数据格式
- 股票代码：{{stockCode}}
- 日期区间：{{dateRange}}
- K线数据（OHLCV）：{{klineData}}

## 判断标准
请仔细分析K线数据，对照上述各项技术要领，判断该股票是否符合策略要求。

请返回：
结果：符合/不符合
原因：详细说明符合或不符合的具体原因，列出符合和不符合的各哪些条件`;

// ============================================
// 策略5：突破买点策略
// ============================================
const breakoutContent = `你是股票策略分析师。请根据以下K线数据，判断股票是否符合「突破买点」策略要求。

## 突破策略条件

**一、盘整结构**
1. 股价在关键位置横盘整理15-30天
2. 波动幅度收窄（震幅小于15%）
3. 成交量逐步萎缩至地量水平

**二、突破确认**
1. 放量突破盘整区间上沿（成交量大于盘整期间平均量的1.5倍）
2. 突破时涨幅大于3%
3. 突破后三天内不回踩突破点

**三、均线配合**
1. 突破时均线呈多头排列或向上发散
2. 股价站稳在5日均线上方

**四、量价配合**
1. 突破时放量，突破后持续放量
2. 回调时缩量，不破关键位置

## 数据格式
- 股票代码：{{stockCode}}
- 日期区间：{{dateRange}}
- K线数据（OHLCV）：{{klineData}}

## 判断标准
请分析K线数据，判断该股票是否满足突破买点条件。

请返回：
结果：符合/不符合
原因：详细说明各项条件是否符合`;

// ============================================
// 策略6：回调买入策略
// ============================================
const pullbackContent = `你是股票策略分析师。请根据以下K线数据，判断股票是否满足「回调买入」策略要求。

## 回调买入条件

**一、趋势确认**
1. 处于上升趋势（20日均线向上）
2. 近期有明显涨幅（10个交易日内涨幅大于15%）

**二、回调识别**
1. 回调幅度：股价回调至近期涨幅的38.2%-50%区间为最佳
2. 回调时间：回调周期为上涨周期的1/3至1/2
3. 回调方式：缩量回调，价格不再创新低

**三、买入信号**
1. 出现缩量十字星、T字线等企稳K线
2. 成交量萎缩至上涨最高量能的30%以下
3. 股价在关键均线或支撑位企稳

**四、风险控制**
1. 回调跌破涨幅起点则止损
2. 回调超过涨幅61.8%则放弃

## 数据格式
- 股票代码：{{stockCode}}
- 日期区间：{{dateRange}}
- K线数据（OHLCV）：{{klineData}}

## 判断标准
请分析K线数据，判断该股票是否满足回调买入条件。

请返回：
结果：符合/不符合
原因：详细说明各项条件是否符合`;

async function main() {
  // 检查并创建均线多头排列提示词
  let maPrompt = await prisma.prompt.findFirst({
    where: { name: "均线多头排列" },
  });
  if (!maPrompt) {
    maPrompt = await prisma.prompt.create({
      data: { name: "均线多头排列", content: maPromptsContent },
    });
    console.log(`Created prompt: ${maPrompt.name} (${maPrompt.id})`);
  } else {
    console.log(`Prompt "${maPrompt.name}" already exists`);
  }

  // 检查并创建底部形态提示词
  let bottomPrompt = await prisma.prompt.findFirst({
    where: { name: "底部形态识别" },
  });
  if (!bottomPrompt) {
    bottomPrompt = await prisma.prompt.create({
      data: { name: "底部形态识别", content: bottomPatternContent },
    });
    console.log(`Created prompt: ${bottomPrompt.name} (${bottomPrompt.id})`);
  } else {
    console.log(`Prompt "${bottomPrompt.name}" already exists`);
  }

  // 检查并创建量能异动提示词
  let volumePrompt = await prisma.prompt.findFirst({
    where: { name: "量能异动检测" },
  });
  if (!volumePrompt) {
    volumePrompt = await prisma.prompt.create({
      data: { name: "量能异动检测", content: volumeSignalContent },
    });
    console.log(`Created prompt: ${volumePrompt.name} (${volumePrompt.id})`);
  } else {
    console.log(`Prompt "${volumePrompt.name}" already exists`);
  }

  // 检查并创建四线开花提示词
  let siXianPrompt = await prisma.prompt.findFirst({
    where: { name: "四线开花模型之倍量颈线买点" },
  });
  if (!siXianPrompt) {
    siXianPrompt = await prisma.prompt.create({
      data: { name: "四线开花模型之倍量颈线买点", content: siXianContent },
    });
    console.log(`Created prompt: ${siXianPrompt.name} (${siXianPrompt.id})`);
  } else {
    console.log(`Prompt "${siXianPrompt.name}" already exists`);
  }

  // 检查并创建突破买点提示词
  let breakoutPrompt = await prisma.prompt.findFirst({
    where: { name: "突破买点策略" },
  });
  if (!breakoutPrompt) {
    breakoutPrompt = await prisma.prompt.create({
      data: { name: "突破买点策略", content: breakoutContent },
    });
    console.log(`Created prompt: ${breakoutPrompt.name} (${breakoutPrompt.id})`);
  } else {
    console.log(`Prompt "${breakoutPrompt.name}" already exists`);
  }

  // 检查并创建回调买入提示词
  let pullbackPrompt = await prisma.prompt.findFirst({
    where: { name: "回调买入策略" },
  });
  if (!pullbackPrompt) {
    pullbackPrompt = await prisma.prompt.create({
      data: { name: "回调买入策略", content: pullbackContent },
    });
    console.log(`Created prompt: ${pullbackPrompt.name} (${pullbackPrompt.id})`);
  } else {
    console.log(`Prompt "${pullbackPrompt.name}" already exists`);
  }

  // 重新获取所有提示词（确保有 id）
  const allPrompts = await prisma.prompt.findMany();
  const promptMap = Object.fromEntries(allPrompts.map((p) => [p.name, p]));

  // 创建策略
  const strategies = [
    {
      name: "均线多头排列",
      description: "基础筛选策略，判断股票是否满足均线多头排列条件",
      promptName: "均线多头排列",
    },
    {
      name: "底部形态识别",
      description: "识别经典底部形态（平底、双底、圆弧底、头肩底等）",
      promptName: "底部形态识别",
    },
    {
      name: "量能异动检测",
      description: "检测倍量阳线、量能堆、量能三阳等量能异动信号",
      promptName: "量能异动检测",
    },
    {
      name: "四线开花之倍量颈线买点",
      description: "完整技术体系，包含均线多头排列、底部形态、量能分析、买入点确认",
      promptName: "四线开花模型之倍量颈线买点",
    },
    {
      name: "突破买点策略",
      description: "基于盘整突破的买入策略，强调量价配合",
      promptName: "突破买点策略",
    },
    {
      name: "回调买入策略",
      description: "上升趋势中的回调买入策略，关注38.2%-50%黄金回调位",
      promptName: "回调买入策略",
    },
  ];

  for (const s of strategies) {
    const existing = await prisma.strategy.findFirst({ where: { name: s.name } });
    if (existing) {
      console.log(`Strategy "${s.name}" already exists`);
      continue;
    }

    const prompt = promptMap[s.promptName];
    if (!prompt) {
      console.error(`Prompt "${s.promptName}" not found for strategy "${s.name}"`);
      continue;
    }

    const strategy = await prisma.strategy.create({
      data: {
        name: s.name,
        description: s.description,
        promptId: prompt.id,
      },
    });
    console.log(`Created strategy: ${strategy.name} (${strategy.id})`);
  }

  console.log("\nAll done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
