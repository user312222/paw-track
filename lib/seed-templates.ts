// Generic starter plans. They contain NO drug names or doses: the veterinarian adds medications per patient.
// These are examples to edit, not clinical guidance.

import type { TemplateStep } from "./care.ts";

type Seed = { name: string; description: string; days: number; steps: TemplateStep[] };

const range = (from: number, to: number, title: string, instructions: string, kind: TemplateStep["kind"]): TemplateStep[] =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ day_no: from + i, title, instructions, kind }));

export const TEMPLATE_SEED: Seed[] = [
  {
    name: "Genel gözlem (7 gün)",
    description: "Teşhis sonrası ilk hafta günlük gözlem.",
    days: 7,
    steps: [
      ...range(1, 7, "İştah, su ve enerjiyi gözlemle", "Gün sonunda aşağıdaki formdan durumu işaretleyin.", "observe"),
      ...range(1, 7, "Tuvalet (idrar/dışkı) düzenini not et", "Beklenmedik değişiklikleri nota yazın.", "observe"),
      { day_no: 7, title: "Gözlem haftası sonu: kliniğe bilgi ver", instructions: "Genel durumu ve notlarınızı klinikle paylaşın.", kind: "task" },
    ],
  },
  {
    name: "Ameliyat sonrası bakım (10 gün)",
    description: "Ameliyat sonrası günlük yara ve genel durum takibi.",
    days: 10,
    steps: [
      { day_no: 1, title: "Sakin ve sıcak bir ortamda dinlendir", instructions: "Koşma ve zıplamadan uzak tutun.", kind: "task" },
      ...range(1, 10, "Koruyucu yaka / giysi takılı olsun", "Yaranın yalanmasını ve kaşınmasını önler.", "task"),
      ...range(1, 10, "Yara yerini kontrol et", "Kızarıklık, şişlik, akıntı veya kanama var mı bakın.", "observe"),
      ...range(1, 3, "Yemek ve su miktarını not et", "Normal, az ya da hiç olarak işaretleyin.", "observe"),
      { day_no: 10, title: "Kontrol randevusu", instructions: "Randevu tarihini klinik belirler.", kind: "task" },
    ],
  },
  {
    name: "Mide-bağırsak şikayeti gözlemi (5 gün)",
    description: "Kusma/ishal sonrası kısa süreli takip.",
    days: 5,
    steps: [
      ...range(1, 5, "Kusma sayısını not et", "Gün içindeki kusma sayısını forma yazın.", "observe"),
      ...range(1, 5, "Dışkı kıvamını ve sıklığını gözle", "Beklenmedik değişiklikleri nota yazın.", "observe"),
      ...range(1, 5, "Su tüketimini izle", "Hiç su içmiyorsa notta belirtin.", "observe"),
    ],
  },
  {
    name: "İlaç kürü takibi (7 gün)",
    description: "İlaçlar hekim tarafından hasta bazında eklenir; bu plan genel çerçeveyi verir.",
    days: 7,
    steps: [
      ...range(1, 7, "Hekimin yazdığı ilaçları eksiksiz ver", "Dozlar aşağıda ilaç satırlarında ayrı ayrı görünür.", "task"),
      { day_no: 7, title: "Kür sonunda kliniğe bilgi ver", instructions: "İlaçların tamamını verdiyseniz ve yan etki gördüyseniz bildirin.", kind: "task" },
    ],
  },
];
