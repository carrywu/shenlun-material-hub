import { BaseCollector } from "./base";
import { XianfengwenhuiCollector } from "./web/xianfengwenhui";
import { PeoplesDailyCollector } from "./web/peoplesDaily";
import { PeopleOpinionCollector } from "./web/peopleOpinion";
import { GuangdongOfficialCollector } from "./web/guangdongOfficial";
import { HunanOfficialCollector } from "./web/hunanOfficial";

const collectorMap = new Map<string, () => BaseCollector>();

// 按 source name 注册
collectorMap.set("先锋文汇", () => new XianfengwenhuiCollector());
collectorMap.set("人民日报", () => new PeoplesDailyCollector());
collectorMap.set("人民网观点", () => new PeopleOpinionCollector());
collectorMap.set("广东省政府网", () => new GuangdongOfficialCollector());
collectorMap.set("湖南省政府网", () => new HunanOfficialCollector());

// 按 collectorType 注册（备用）
collectorMap.set("xianfengwenhui", () => new XianfengwenhuiCollector());
collectorMap.set("peoples_daily", () => new PeoplesDailyCollector());
collectorMap.set("people_opinion", () => new PeopleOpinionCollector());
collectorMap.set("guangdong_official", () => new GuangdongOfficialCollector());
collectorMap.set("hunan_official", () => new HunanOfficialCollector());

export function getCollector(source: {
  name: string;
  collectorType?: string;
}): BaseCollector | null {
  if (source.collectorType) {
    const factory = collectorMap.get(source.collectorType);
    if (factory) return factory();
  }
  const factory = collectorMap.get(source.name);
  return factory ? factory() : null;
}

export function listCollectors(): Array<{
  name: string;
  collectorType: string;
}> {
  return [
    { name: "先锋文汇", collectorType: "xianfengwenhui" },
    { name: "人民日报", collectorType: "peoples_daily" },
    { name: "人民网观点", collectorType: "people_opinion" },
    { name: "广东省政府网", collectorType: "guangdong_official" },
    { name: "湖南省政府网", collectorType: "hunan_official" },
  ];
}
