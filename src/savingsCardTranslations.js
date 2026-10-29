const sources=['Already transferred','Current profit','Profit allocation breakdown','Ready to transfer','Remaining to your goal','Retained ·','Saved balance','Savings goal progress','To savings ·','of goal','{0}% retained; {1}% allocated to savings'];
const rows={
  es:['Ya transferido','Beneficio actual','Desglose de la asignación del beneficio','Listo para transferir','Restante para tu objetivo','Retenido ·','Saldo ahorrado','Progreso del objetivo de ahorro','A ahorros ·','del objetivo','{0}% retenido; {1}% asignado a ahorros'],
  fr:['Déjà transféré','Bénéfice actuel','Répartition du bénéfice','Prêt à transférer','Reste pour votre objectif','Conservé ·','Solde épargné','Progression de l’objectif d’épargne','Vers l’épargne ·','de l’objectif','{0}% conservé ; {1}% affecté à l’épargne'],
  de:['Bereits überwiesen','Aktueller Gewinn','Gewinnverteilung','Bereit zur Überweisung','Bis zum Ziel verbleibend','Einbehalten ·','Sparguthaben','Fortschritt des Sparziels','Zum Sparen ·','des Ziels','{0}% einbehalten; {1}% zum Sparen zugeteilt'],
  pt:['Já transferido','Lucro atual','Distribuição do lucro','Pronto para transferir','Restante para a meta','Retido ·','Saldo poupado','Progresso da meta de poupança','Para poupança ·','da meta','{0}% retido; {1}% destinado à poupança'],
  it:['Già trasferito','Profitto attuale','Ripartizione del profitto','Pronto da trasferire','Rimanente per il tuo obiettivo','Trattenuto ·','Saldo risparmiato','Avanzamento dell’obiettivo di risparmio','Ai risparmi ·','dell’obiettivo','{0}% trattenuto; {1}% destinato ai risparmi'],
  ja:['振替済み','現在の利益','利益配分の内訳','振替可能','目標までの残額','留保 ·','貯蓄残高','貯蓄目標の進捗','貯蓄へ ·','目標に対して','{0}%を留保、{1}%を貯蓄に配分'],
  ko:['이미 이체됨','현재 수익','수익 배분 내역','이체 가능','목표까지 남은 금액','유보 ·','저축 잔액','저축 목표 진행률','저축으로 ·','목표 대비','{0}% 유보, {1}% 저축 배분'],
  ru:['Уже переведено','Текущая прибыль','Распределение прибыли','Готово к переводу','Осталось до цели','Оставлено ·','Накопленный баланс','Прогресс цели накоплений','В накопления ·','от цели','{0}% оставлено; {1}% выделено на накопления'],
  tr:['Zaten aktarıldı','Mevcut kâr','Kâr dağılımı','Aktarmaya hazır','Hedefe kalan','Tutulan ·','Birikim bakiyesi','Birikim hedefi ilerlemesi','Birikime ·','hedefin','%{0} tutuldu; %{1} birikime ayrıldı'],
  ar:['تم التحويل بالفعل','الربح الحالي','تفاصيل توزيع الربح','جاهز للتحويل','المتبقي للوصول إلى هدفك','المحتفظ به ·','رصيد الادخار','تقدم هدف الادخار','إلى الادخار ·','من الهدف','تم الاحتفاظ بنسبة {0}% وتخصيص {1}% للادخار'],
  hi:['पहले ही स्थानांतरित','वर्तमान लाभ','लाभ आवंटन का विवरण','स्थानांतरण के लिए तैयार','लक्ष्य तक शेष','रखा गया ·','बचत शेष','बचत लक्ष्य की प्रगति','बचत में ·','लक्ष्य का','{0}% रखा गया; {1}% बचत को आवंटित'],
  zh:['已转入','当前利润','利润分配明细','可转入','距目标剩余','保留 ·','储蓄余额','储蓄目标进度','用于储蓄 ·','目标完成度','保留 {0}%；分配 {1}% 用于储蓄'],
  id:['Sudah ditransfer','Laba saat ini','Rincian alokasi laba','Siap ditransfer','Sisa menuju target','Ditahan ·','Saldo tabungan','Kemajuan target tabungan','Ke tabungan ·','dari target','{0}% ditahan; {1}% dialokasikan ke tabungan'],
};
export const savingsCardMessages=Object.fromEntries(sources.map((source,index)=>[source,Object.fromEntries(Object.entries(rows).map(([locale,values])=>[locale,values[index]]))]));
