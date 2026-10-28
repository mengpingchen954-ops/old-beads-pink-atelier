export const CONSTRUCTION_AREAS = [
  {id:'shop', name:'粉瓣小店', unlock:0, tasks:['修好招牌','擦亮橱窗','挂上珠串','点亮门灯']},
  {id:'studio', name:'手作工坊', unlock:4, tasks:['铺好工作台','整理珠罐','修复天窗','挂起风铃']},
  {id:'garden', name:'玫瑰庭院', unlock:8, tasks:['扶正花架','种下蔷薇','铺好小路','布置茶桌']}
];
export const CONSTRUCTION_TASKS = CONSTRUCTION_AREAS.flatMap((area, areaIndex) => area.tasks.map((name, taskIndex) => ({
  id: areaIndex * 4 + taskIndex, area: area.id, areaIndex, taskIndex, name
})));
export function repairedCount(progress) {
  const completed = Array.isArray(progress?.completed) ? progress.completed : [];
  const built = Number.isInteger(progress?.construction?.built) ? progress.construction.built : 0;
  return Math.max(0, Math.min(completed.length, Math.min(12, built)));
}
export function constructionState(progress) {
  const repaired = repairedCount(progress);
  const built = Array.from({length: repaired}, (_, i) => i);
  return {repaired, built, available: Math.max(0, (progress.completed?.length ?? 0) - repaired)};
}
export function canRepair(progress, id) {
  const repaired = repairedCount(progress);
  return Number.isInteger(id) && id === repaired && id < progress.completed.length;
}
export function repairTask(progress, id) {
  if (!canRepair(progress, id)) return null;
  const next = {...progress, construction:{...(progress.construction||{}), built:id+1}};
  return {progress:next, task:CONSTRUCTION_TASKS[id]};
}
export function areaForTask(id) { return CONSTRUCTION_TASKS[id]?.area ?? 'shop'; }
export function unlockedAreas(progress) {
  const repaired = repairedCount(progress);
  return CONSTRUCTION_AREAS.filter(a => repaired >= a.unlock).map(a => a.id);
}
