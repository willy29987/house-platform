export type ServiceItem = {
  slug: string;
  title: string;
  image: string;
  summary: string;
  intro: string;
  highlights: string[];
  process: string[];
  suitableFor: string[];
};

export const services: ServiceItem[] = [
  {
    slug: "residential-rent-sale",
    title: "房屋租賃買賣",
    image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80",
    summary: "從租屋、出租、買房到出售，協助你掌握行情、條件篩選與交易流程。",
    intro:
      "住宅交易最怕資訊不對稱。我們協助屋主與客戶整理物件條件、評估市場行情、安排帶看溝通，讓租賃與買賣流程更清楚、更有效率。",
    highlights: ["租金與售價行情評估", "物件條件包裝與曝光建議", "客戶需求篩選與帶看安排", "議價、簽約與交屋流程提醒"],
    process: ["確認需求與預算", "整理物件條件與市場定位", "安排曝光與帶看", "協助談判、簽約與後續交接"],
    suitableFor: ["想出租或出售住宅的屋主", "正在找租屋或買房的客戶", "需要專人協助比較物件的人"],
  },
  {
    slug: "retail-rent-sale",
    title: "店面租賃買賣",
    image: "https://images.unsplash.com/photo-1604328698692-f76ea9498e76?auto=format&fit=crop&w=1200&q=80",
    summary: "協助店面選址、租售評估與商圈條件判斷，降低開店與持有風險。",
    intro:
      "店面不只看坪數和租金，更要看人流、招牌面、使用限制與商圈型態。我們協助業主與承租方釐清條件，讓店面租售更貼近營運需求。",
    highlights: ["商圈與路段條件判斷", "店面租金與出售行情分析", "使用需求與物件條件媒合", "承租方/買方溝通與合約提醒"],
    process: ["確認營業型態或投資目標", "評估商圈、人流與租售價格", "篩選合適店面", "協助條件談判與簽約"],
    suitableFor: ["準備開店的品牌或個人", "持有店面想出租出售的屋主", "想投資店面收益的人"],
  },
  {
    slug: "office-rent-sale",
    title: "商辦租賃買賣",
    image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80",
    summary: "依照企業規模、交通、格局與預算，協助媒合合適商辦空間。",
    intro:
      "商辦空間牽涉企業形象、員工通勤、裝修彈性與長期成本。我們協助企業與業主整理條件，快速找到適合的辦公室或投資標的。",
    highlights: ["辦公室坪效與格局評估", "交通機能與企業形象條件整理", "租金/管理費/裝修成本比較", "商辦租售流程協助"],
    process: ["確認人數、預算與地點", "篩選商辦條件與可用格局", "安排看屋與條件比較", "協助合約與進駐時程規劃"],
    suitableFor: ["新創或企業搬遷", "需要擴編辦公空間的公司", "商辦持有人或投資人"],
  },
  {
    slug: "property-investment",
    title: "不動產投資",
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80",
    summary: "協助評估收益、風險、區域潛力與退出策略，讓投資判斷更有依據。",
    intro:
      "不動產投資不能只看表面投報率。我們協助你從租金行情、空置風險、持有成本、區域發展與轉手性來做完整評估。",
    highlights: ["租金收益與持有成本試算", "區域發展與轉手性分析", "物件風險與管理難度判斷", "投資策略與標的篩選"],
    process: ["確認資金規模與投資目標", "建立收益與風險條件", "篩選與比較標的", "規劃持有管理與退出方向"],
    suitableFor: ["想開始不動產投資的人", "需要比較多個標的的投資人", "重視穩定收益與風險控管的人"],
  },
  {
    slug: "rental-management",
    title: "包租代管",
    image: "https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=1200&q=80",
    summary: "協助屋主處理出租、收租、修繕溝通與租客管理，降低管理成本。",
    intro:
      "出租不是把房子租出去就結束，後續還有租客溝通、修繕、收租與續約。我們協助屋主建立更穩定的出租管理流程。",
    highlights: ["租客篩選與入住流程", "收租與續約提醒", "修繕與日常溝通協調", "空租期與出租條件優化"],
    process: ["評估房屋狀態與出租條件", "整理出租方案與租客條件", "協助出租與入住管理", "持續追蹤收租、修繕與續約"],
    suitableFor: ["沒有時間管理出租物件的屋主", "外地屋主或多屋持有人", "希望出租更穩定的人"],
  },
  {
    slug: "interior-renovation",
    title: "室內裝修",
    image: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80",
    summary: "依照出租、出售或自住目的，協助規劃裝修方向與預算重點。",
    intro:
      "裝修不只是美觀，也關係到出租速度、售價呈現與居住品質。我們協助你依照用途決定裝修優先順序，避免不必要的浪費。",
    highlights: ["出租/出售前整理建議", "預算與裝修優先順序規劃", "空間機能與視覺呈現優化", "裝修後租售策略銜接"],
    process: ["確認裝修目的與預算", "檢查現況與問題點", "規劃優先施作項目", "銜接出租、出售或自住需求"],
    suitableFor: ["想提高出租吸引力的屋主", "出售前需要整理物件的人", "想改善居住品質的自住客"],
  },
];

export function getServiceBySlug(slug: string) {
  return services.find((service) => service.slug === slug) ?? null;
}
