/* ============================================================================
 * 拾光校园 · 种子数据
 * ----------------------------------------------------------------------------
 * 首次打开页面（localStorage 还是空的）时灌入这些数据，让列表不至于空着。
 * 用户在「重置演示数据」时也会回到这里。
 *
 * 注意：这是 .js 不是 .json —— file:// 下 fetch 会被 CORS 拦掉，
 * 种子数据只能靠 <script> 加载。
 *
 * 时间用「距今 N 小时」表示，在灌入时才换算成真实时间戳，
 * 这样不管哪天打开，列表里都有「今天 / 昨天 / 2 小时前」的观感。
 * ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./core.js'));
  } else {
    root.LF = root.LF || {};
    root.LF.buildSeedItems = factory(root.LF);
  }
})(typeof self !== 'undefined' ? self : this, function (LF) {
  'use strict';

  var ME = LF.CURRENT_USER;                                     // 小白同学
  var OTHER = { name: '小金毛同学', college: '计算机学院', grade: '2023级' };

  /**
   * 原型里每条数据都长这样：
   *   hoursAgo  —— 距今几小时（丢失/拾到时间）
   *   postedAgo —— 距今几小时发布的
   *   image     —— assets/items/ 下的占位图（按类别画的矢量图，见 assets/items/README 说明）
   * 其余字段含义见 js/core.js 顶部注释。
   */
  var RAW = [
    {
      slug: 'item-01', kind: 'found', category: 'digital', hoursAgo: 3, postedAgo: 2,
      title: '黑色 Sony 降噪耳机',
      place: '图书馆三楼 C 区自习室',
      desc: '在图书馆三楼 C 区 042 号座位桌面上捡到的，头戴式，黑色，带一个磨砂收纳包。'
          + '目前已交给图书馆一楼服务台值班同学保管，请失主凭身份信息前往认领。',
      contact: { type: 'phone', value: '138-0013-8000' },
      author: OTHER
    },
    {
      slug: 'item-02', kind: 'lost', category: 'other', hoursAgo: 20, postedAgo: 19,
      title: '蓝色水壶 + 线条小狗挂件',
      place: '操场看台或二食堂',
      desc: '蓝色保温壶，壶身上挂了一只有点掉漆的线条小狗玩偶，对我来说很重要。'
          + '昨天下午在操场看完运动会后就不见了，可能落在看台，也可能带去二食堂了。',
      contact: { type: 'wechat', value: 'shiguang_2024' },
      author: ME
    },
    {
      slug: 'item-03', kind: 'found', category: 'digital', hoursAgo: 26, postedAgo: 25,
      title: '银色 Apple iPad Air',
      place: '第一教学楼 302 教室',
      desc: '下课后在 302 教室第三排座位上发现的，银色 iPad Air，深蓝色保护壳，'
          + '屏幕左上角有一道细划痕。锁屏壁纸是一只柯基，应该是主人自己拍的。',
      contact: { type: 'qq', value: '123456789' },
      author: OTHER
    },
    {
      /* 下面 4 条（04 / 05 / 06 / 09）故意写得很老：13 个月 / 8 个月 / 2 个月 / 20 天。
         广场页右上角的「时间范围」筛选（仅近 7 天 / 近 30 天 / 近半年 / 近一年）如果
         9 条全是「几小时前」，四档点下去条数一模一样，功能再对也看不出效果。
         拉开之后四档依次是 5 / 6 / 7 / 8 条，最后一档「全部时间」才把 04 放出来。
         首屏观感不受影响 —— 默认「最新发布在前」，这几条本来就在最下面。 */
      slug: 'item-04', kind: 'lost', category: 'card', hoursAgo: 9600, postedAgo: 9598,
      title: '黑色校园卡（姓名：张*明）',
      place: '三食堂或西田径场',
      desc: '校园卡外壳是黑色的，卡面姓名张*明。可能就是吃饭或者跑完步之后掉的。'
          + '里面没多少钱，但补办要等一周，希望能找到。',
      contact: { type: 'phone', value: '139-0013-9000' },
      author: ME
    },
    {
      slug: 'item-05', kind: 'found', category: 'card', hoursAgo: 5856, postedAgo: 5854,
      title: '蓝色卡套一卡通',
      place: '图书馆一楼服务台',
      desc: '在图书馆一楼电梯口捡到的一卡通，装在蓝色硅胶卡套里，卡套背面贴了一张动漫贴纸。'
          + '已放在一楼服务台，请本人来认领。',
      contact: { type: 'wechat', value: 'wxid_libdesk' },
      author: OTHER
    },
    {
      slug: 'item-06', kind: 'lost', category: 'other', hoursAgo: 1464, postedAgo: 1462,
      title: '粉色天堂晴雨伞',
      place: '艺术楼 B 座琴房',
      desc: '伞是淡粉色的，伞柄上有一个小小的猫咪挂饰。练习完钢琴走得急，'
          + '想起来的时候伞已经不在了。琴房 3 和琴房 5 都找过了。',
      contact: { type: 'phone', value: '137-0013-7000' },
      author: ME
    },
    {
      slug: 'item-07', kind: 'lost', category: 'stationery', hoursAgo: 52, postedAgo: 50,
      title: '卡西欧计算器（FX-991CN）',
      place: '3 号实验楼 201 教室',
      desc: '黑色卡西欧 FX-991CN X，背面用油性笔写了名字的拼音缩写。'
          + '应该是上周五物理实验课落在教室了，考场要用的，有点着急。',
      contact: { type: 'qq', value: '987654321' },
      author: OTHER
    },
    {
      slug: 'item-08', kind: 'found', category: 'digital', hoursAgo: 72, postedAgo: 70,
      title: '蓝牙耳机充电盒',
      place: '二食堂二楼餐台',
      desc: '白色的无线耳机充电盒，没有耳机在里面，只有盒子。已经放我这儿两天了，'
          + '失主可以直接联系我拿回去。',
      contact: { type: 'wechat', value: 'shiguang_2024' },
      author: ME,
      done: true                                            // 已归还，用来演示完成态
    },
    {
      slug: 'item-09', kind: 'found', category: 'keychain', hoursAgo: 480, postedAgo: 478,
      title: '黑色车钥匙（带皮质钥匙扣）',
      place: '北田径场看台第一排',
      desc: '一把黑色车钥匙，挂着一个棕色皮质钥匙扣，上面还串了个小铃铛。'
          + '在北田径场看台第一排座位缝里捡到的。',
      contact: { type: 'phone', value: '136-0013-6000' },
      author: OTHER
    }
  ];

  function hoursAgoToIso(hours, now) {
    return new Date(now.getTime() - hours * 3600000).toISOString();
  }

  /**
   * 生成种子数据。now 可注入，方便测试；不传就用当前时间。
   */
  function build(now) {
    var base = now ? new Date(now) : new Date();

    return RAW.map(function (raw, index) {
      var happenedAt = hoursAgoToIso(raw.hoursAgo, base);
      var createdAt = hoursAgoToIso(raw.postedAgo, base);
      var lastAt = raw.done ? hoursAgoToIso(Math.max(raw.postedAgo - 2, 0.5), base) : createdAt;

      var timeline = [{ state: 'open', at: createdAt }];
      if (raw.done) timeline.push({ state: 'done', at: lastAt });

      return {
        // 种子数据的 id 固定，方便演示时直接引用（LF-<日期>-<序号>，日期部分随灌入日期走）
        id: 'LF-' + base.getFullYear()
            + ('0' + (base.getMonth() + 1)).slice(-2)
            + ('0' + base.getDate()).slice(-2)
            + '-' + ('00' + (index + 1)).slice(-3),
        kind: raw.kind,
        title: raw.title,
        category: raw.category,
        place: raw.place,
        happenedAt: happenedAt,
        desc: raw.desc,
        images: ['assets/items/' + raw.slug + '.svg'],
        contact: { type: raw.contact.type, value: raw.contact.value },
        state: raw.done ? 'done' : 'open',
        author: raw.author,
        createdAt: createdAt,
        updatedAt: lastAt,
        timeline: timeline
      };
    });
  }

  return build;
});
