// Human-authored additions for new screens; no translation network calls at runtime.
import {savingsCardMessages} from './savingsCardTranslations.js';
import {landingMessages} from './landingTranslations.js';
// The phone routine card separates its label and completion state around progress.
const sources = `A plan you can follow level by level.
AAICOREFX TRADING JOURNAL
ACCOUNT CHALLENGES
ALSO IN YOUR JOURNAL
Account, instrument, session, and result filters
Adjustable reward ratio and plan length
BACKTESTING
Backtest trades
Can I change the language and appearance?
Choose your language, timezone, and date and time formats in Personalization. Keep the same workspace in a light or dark theme, with your choice of accent color.
Create a separate test account with its own starting balance and risk per trade. Log simulated trades and follow the equity curve as the test develops.
Does backtesting change my live journal?
English and 13 other languages, including Arabic with right-to-left layout.
Filter the log and review ten trades at a time.
Goals, risk limits, and challenge setup
Keep a record.
Keep the account details in one place.
Keep your setup and analysis together, with the date, time, session, and chart screenshots. Link a trade to its markup to compare what you planned with what you did.
Know what happened.
Light, dark, or system theme with a quick left-to-right theme switch.
Linked plans, results, and capture coverage
Log prices, risk, commission, and screenshots in Execution. Use Process to check your rules, record confluences and mistakes, and leave notes for your next review.
No. Backtest accounts and their simulated trades are separate from live accounts. You can review the simulated balance, equity curve, profit factor, win rate, and trade outcomes without changing your live journal.
PROFILE SETTINGS
Password settings and manual journal sync, together in one tab.
Position sizing defaults
Practice without changing your live results.
Prepare your charts, log your trades, test your setups, and review the results. Your accounts and trading notes stay together.
Profit factor, win rate, average R:R, and trade outcomes.
Results
Risk Limit and Two-Loss Streak modes
Rule evaluation alongside each trade
Save the setup before you take the trade.
See what’s inside
Separate challenges for individual accounts
Separate records
Sessions determined from entry time
Set up a challenge from Account Settings. Choose the reward ratio, plan length, and current level, then use Risk Limit or Two-Loss Streak mode to track your progress.
Set your balances, currency, breakeven cap, and default commission. Add sizing defaults, goals, loss limits, and a challenge without leaving Account Settings.
Setup and analysis in one form
Simulated trades stay out of your live balance and journal.
Single or multiple account balances
TRADE LOG
Test a setup. Make the workspace yours.
The execution and the decisions behind it.
Trade Record
Trade history
Trade review sections
Use the journal the way you read it.
Year, month, and week filters
Yes. Profile settings includes Personalization for language, timezone, date and time formats, theme, and accent colors. English is the default, with 13 other languages including Arabic. Manual journal sync is in Security.
Avg Win/Loss`.split('\n');
const rows = {};
rows.de = `Ein Plan, dem du Stufe für Stufe folgen kannst.
AAICOREFX HANDELSJOURNAL
KONTO-CHALLENGES
AUCH IN DEINEM JOURNAL
Filter für Konto, Instrument, Sitzung und Ergebnis
Anpassbares Ertragsverhältnis und Planlänge
BACKTESTING
Backtest-Trades
Kann ich Sprache und Erscheinungsbild ändern?
Wähle unter Personalisierung Sprache, Zeitzone sowie Datums- und Zeitformat. Nutze denselben Arbeitsbereich mit hellem oder dunklem Design und deiner Akzentfarbe.
Erstelle ein separates Testkonto mit eigenem Startkapital und Risiko pro Trade. Erfasse simulierte Trades und verfolge die Kapitalkurve.
Verändert Backtesting mein Live-Journal?
Englisch und 13 weitere Sprachen, darunter Arabisch mit Schreibrichtung von rechts nach links.
Filtere das Journal und überprüfe jeweils zehn Trades.
Ziele, Risikolimits und Challenge-Einrichtung
Führe Aufzeichnungen.
Alle Kontodetails an einem Ort.
Halte Setup, Analyse, Datum, Zeit, Sitzung und Chartbilder zusammen. Verknüpfe einen Trade mit seiner Chartanalyse, um Planung und Ausführung zu vergleichen.
Verstehe, was passiert ist.
Helles, dunkles oder Systemdesign mit schnellem Wechsel von links nach rechts.
Verknüpfte Pläne, Ergebnisse und Dokumentationsabdeckung
Erfasse Preise, Risiko, Gebühren und Bilder unter Ausführung. Prüfe unter Prozess deine Regeln, Konfluenzfaktoren und Fehler und notiere Gedanken für die nächste Überprüfung.
Nein. Testkonten und simulierte Trades sind getrennt von Live-Konten. Prüfe Testkontostand, Kapitalkurve, Profitfaktor, Gewinnquote und Ergebnisse, ohne dein Live-Journal zu ändern.
PROFILEINSTELLUNGEN
Passworteinstellungen und manuelle Synchronisierung in einem Tab.
Standardwerte für Positionsgrößen
Übe, ohne deine Live-Ergebnisse zu ändern.
Bereite Charts vor, erfasse Trades, teste Setups und prüfe Ergebnisse. Konten und Handelsnotizen bleiben zusammen.
Profitfaktor, Gewinnquote, durchschnittliches R:R und Trade-Ergebnisse.
Ergebnisse
Modi Risikolimit und Zwei-Verlust-Serie
Regelauswertung zu jedem Trade
Speichere das Setup vor dem Trade.
Entdecke die Funktionen
Separate Challenges für einzelne Konten
Getrennte Aufzeichnungen
Sitzungen anhand der Einstiegszeit
Richte in den Kontoeinstellungen eine Challenge ein. Wähle Ertragsverhältnis, Planlänge und aktuelle Stufe und verfolge den Fortschritt im Modus Risikolimit oder Zwei-Verlust-Serie.
Lege Kontostände, Währung, Breakeven-Grenze und Standardgebühr fest. Ergänze Positionsgrößen, Ziele, Verlustlimits und eine Challenge in den Kontoeinstellungen.
Setup und Analyse in einem Formular
Simulierte Trades verändern weder Live-Kontostand noch Live-Journal.
Einzelne oder mehrere Kontostände
HANDELSJOURNAL
Teste ein Setup. Gestalte deinen Arbeitsbereich.
Die Ausführung und die Entscheidungen dahinter.
Trade-Aufzeichnung
Handelshistorie
Bereiche der Trade-Überprüfung
Nutze das Journal in deiner bevorzugten Darstellung.
Filter für Jahr, Monat und Woche
Ja. Unter Personalisierung findest du Sprache, Zeitzone, Datums- und Zeitformate, Design und Akzentfarben. Englisch ist Standard, daneben gibt es 13 Sprachen einschließlich Arabisch. Manuelle Synchronisierung findest du unter Sicherheit.
Ø Gewinn/Verlust`;
rows.ar = `خطة تتبعها مستوى بعد مستوى.
سجل تداول AAICOREFX
تحديات الحسابات
أيضًا في سجلك
تصفية حسب الحساب والأداة والجلسة والنتيجة
نسبة عائد وطول خطة قابلان للتعديل
الاختبار التاريخي
صفقات الاختبار التاريخي
هل يمكنني تغيير اللغة والمظهر؟
اختر اللغة والمنطقة الزمنية وتنسيقات التاريخ والوقت في التخصيص. استخدم مساحة العمل نفسها بمظهر فاتح أو داكن ولون التمييز الذي تختاره.
أنشئ حساب اختبار منفصلًا برصيد ابتدائي ومخاطرة لكل صفقة. سجّل صفقات محاكاة وتابع منحنى رأس المال أثناء الاختبار.
هل يغيّر الاختبار التاريخي سجلي الحقيقي؟
الإنجليزية و13 لغة أخرى، بما فيها العربية بتخطيط من اليمين إلى اليسار.
صفِّ السجل وراجع عشر صفقات في كل مرة.
الأهداف وحدود المخاطرة وإعداد التحدي
احتفظ بسجل.
تفاصيل الحساب في مكان واحد.
اجمع الإعداد والتحليل مع التاريخ والوقت والجلسة وصور الرسم البياني. اربط الصفقة بتحليلها لمقارنة الخطة بالتنفيذ.
افهم ما حدث.
مظهر فاتح أو داكن أو حسب النظام مع تبديل سريع من اليسار إلى اليمين.
الخطط المرتبطة والنتائج ومدى التوثيق
سجّل الأسعار والمخاطرة والعمولة والصور في التنفيذ. استخدم العملية لتقييم القواعد وتسجيل عوامل التوافق والأخطاء وملاحظات المراجعة القادمة.
لا. حسابات الاختبار وصفقات المحاكاة منفصلة عن الحسابات الحقيقية. راجع الرصيد التجريبي ومنحنى رأس المال ومعامل الربح ونسبة الفوز والنتائج دون تغيير سجلك الحقيقي.
إعدادات الملف الشخصي
إعدادات كلمة المرور والمزامنة اليدوية في علامة تبويب واحدة.
إعدادات حجم الصفقة الافتراضية
تدرّب دون تغيير نتائجك الحقيقية.
جهّز الرسوم وسجّل الصفقات واختبر الإعدادات وراجع النتائج. تبقى حساباتك وملاحظات التداول معًا.
معامل الربح ونسبة الفوز ومتوسط المخاطرة إلى العائد ونتائج الصفقات.
النتائج
وضعا حد المخاطرة وخسارتين متتاليتين
تقييم القواعد لكل صفقة
احفظ الإعداد قبل دخول الصفقة.
اكتشف الميزات
تحديات منفصلة لكل حساب
سجلات منفصلة
تحديد الجلسة حسب وقت الدخول
أنشئ تحديًا من إعدادات الحساب. اختر نسبة العائد وطول الخطة والمستوى الحالي ثم تابع التقدم بوضع حد المخاطرة أو خسارتين متتاليتين.
حدّد الأرصدة والعملة وحد التعادل والعمولة الافتراضية. أضف إعدادات الحجم والأهداف وحدود الخسارة والتحدي من إعدادات الحساب.
الإعداد والتحليل في نموذج واحد
صفقات المحاكاة لا تؤثر في رصيدك أو سجلك الحقيقي.
رصيد حساب واحد أو أرصدة متعددة
سجل الصفقات
اختبر إعدادًا. خصّص مساحة عملك.
التنفيذ والقرارات وراءه.
سجل الصفقة
تاريخ الصفقات
أقسام مراجعة الصفقة
استخدم السجل بالطريقة التي تناسبك.
تصفية حسب السنة والشهر والأسبوع
نعم. يضم التخصيص اللغة والمنطقة الزمنية وتنسيقات التاريخ والوقت والمظهر والألوان. الإنجليزية افتراضية مع 13 لغة أخرى منها العربية. المزامنة اليدوية في الأمان.
متوسط الربح/الخسارة`;
rows.es = `Un plan que puedes seguir nivel a nivel.
DIARIO DE TRADING AAICOREFX
DESAFÍOS DE CUENTA
TAMBIÉN EN TU DIARIO
Filtros por cuenta, instrumento, sesión y resultado
Relación de recompensa y duración ajustables
PRUEBAS HISTÓRICAS
Operaciones de backtest
¿Puedo cambiar el idioma y la apariencia?
Elige idioma, zona horaria y formatos de fecha y hora en Personalización. Usa el mismo espacio con tema claro u oscuro y tu color de acento.
Crea una cuenta de prueba separada con saldo inicial y riesgo por operación. Registra operaciones simuladas y sigue la curva de capital.
¿El backtest cambia mi diario real?
Inglés y otros 13 idiomas, incluido árabe con diseño de derecha a izquierda.
Filtra el diario y revisa diez operaciones a la vez.
Objetivos, límites de riesgo y configuración del desafío
Lleva un registro.
Todos los datos de la cuenta en un lugar.
Guarda configuración y análisis con fecha, hora, sesión y capturas. Vincula la operación con su análisis gráfico para comparar el plan y la ejecución.
Comprende lo que pasó.
Tema claro, oscuro o del sistema con cambio rápido de izquierda a derecha.
Planes vinculados, resultados y cobertura de capturas
Registra precios, riesgo, comisión y capturas en Ejecución. En Proceso, evalúa reglas, confluencias y errores y deja notas para la próxima revisión.
No. Las cuentas de prueba y sus operaciones simuladas están separadas de las reales. Revisa saldo simulado, curva de capital, factor de beneficio, tasa de acierto y resultados sin cambiar tu diario real.
AJUSTES DEL PERFIL
Contraseña y sincronización manual en una misma pestaña.
Valores predeterminados de tamaño de posición
Practica sin cambiar tus resultados reales.
Prepara gráficos, registra operaciones, prueba configuraciones y revisa resultados. Tus cuentas y notas de trading permanecen juntas.
Factor de beneficio, tasa de acierto, R:R medio y resultados.
Resultados
Modos Límite de riesgo y Dos pérdidas consecutivas
Evaluación de reglas en cada operación
Guarda la configuración antes de operar.
Descubre las funciones
Desafíos separados por cuenta
Registros separados
Sesiones determinadas por la hora de entrada
Crea un desafío en Ajustes de cuenta. Elige recompensa, duración y nivel actual, y sigue el progreso con Límite de riesgo o Dos pérdidas consecutivas.
Configura saldos, moneda, límite de equilibrio y comisión. Añade tamaño, objetivos, límites de pérdida y desafío desde Ajustes de cuenta.
Configuración y análisis en un formulario
Las operaciones simuladas no afectan al saldo ni al diario real.
Uno o varios saldos de cuenta
REGISTRO DE OPERACIONES
Prueba una configuración. Haz tuyo el espacio.
La ejecución y las decisiones detrás de ella.
Registro de operación
Historial de operaciones
Secciones de revisión de operaciones
Usa el diario a tu manera.
Filtros de año, mes y semana
Sí. Personalización incluye idioma, zona horaria, formatos, tema y colores. Inglés es el predeterminado, con otros 13 idiomas incluido árabe. La sincronización manual está en Seguridad.
Ganancia/pérdida media`;
rows.fr = `Un plan à suivre niveau par niveau.
JOURNAL DE TRADING AAICOREFX
DÉFIS DE COMPTE
AUSSI DANS VOTRE JOURNAL
Filtres par compte, instrument, séance et résultat
Ratio de rendement et durée ajustables
TESTS HISTORIQUES
Trades de backtest
Puis-je changer la langue et l’apparence ?
Choisissez langue, fuseau horaire et formats dans Personnalisation. Gardez le même espace en thème clair ou sombre avec votre couleur d’accent.
Créez un compte de test distinct avec capital initial et risque par trade. Consignez les trades simulés et suivez la courbe de capital.
Le backtest modifie-t-il mon journal réel ?
Anglais et 13 autres langues, dont l’arabe avec affichage de droite à gauche.
Filtrez le journal et examinez dix trades à la fois.
Objectifs, limites de risque et configuration du défi
Gardez une trace.
Les détails du compte au même endroit.
Réunissez configuration, analyse, date, heure, séance et captures. Reliez le trade à son analyse graphique pour comparer prévision et exécution.
Comprenez ce qui s’est passé.
Thème clair, sombre ou système avec transition rapide de gauche à droite.
Plans liés, résultats et couverture des captures
Consignez prix, risque, commission et captures dans Exécution. Dans Processus, évaluez règles, confluences et erreurs et laissez des notes pour la prochaine revue.
Non. Les comptes de test et trades simulés sont séparés des comptes réels. Examinez solde simulé, courbe de capital, facteur de profit, taux de réussite et résultats sans modifier votre journal réel.
PARAMÈTRES DU PROFIL
Mot de passe et synchronisation manuelle dans un même onglet.
Taille de position par défaut
Entraînez-vous sans modifier vos résultats réels.
Préparez vos graphiques, consignez vos trades, testez vos configurations et examinez les résultats. Comptes et notes restent ensemble.
Facteur de profit, taux de réussite, R:R moyen et résultats.
Résultats
Modes Limite de risque et Deux pertes consécutives
Évaluation des règles pour chaque trade
Enregistrez la configuration avant de trader.
Découvrez les fonctionnalités
Défis distincts par compte
Registres séparés
Séances déterminées par l’heure d’entrée
Créez un défi dans les paramètres du compte. Choisissez ratio, durée et niveau actuel, puis suivez le progrès avec Limite de risque ou Deux pertes consécutives.
Définissez soldes, devise, seuil d’équilibre et commission. Ajoutez taille, objectifs, limites de perte et défi depuis les paramètres du compte.
Configuration et analyse dans un formulaire
Les trades simulés n’affectent ni solde ni journal réels.
Un ou plusieurs soldes de compte
JOURNAL DES TRADES
Testez une configuration. Personnalisez votre espace.
L’exécution et les décisions qui l’expliquent.
Fiche du trade
Historique des trades
Sections de revue du trade
Utilisez le journal selon vos habitudes.
Filtres par année, mois et semaine
Oui. Personnalisation regroupe langue, fuseau, formats, thème et couleurs. L’anglais est proposé par défaut avec 13 autres langues dont l’arabe. La synchronisation manuelle est dans Sécurité.
Gain/perte moyens`;
rows.pt = `Um plano para seguir nível a nível.
DIÁRIO DE TRADING AAICOREFX
DESAFIOS DE CONTA
TAMBÉM NO SEU DIÁRIO
Filtros por conta, instrumento, sessão e resultado
Relação de retorno e duração ajustáveis
TESTES HISTÓRICOS
Operações de backtest
Posso mudar o idioma e a aparência?
Escolha idioma, fuso horário e formatos em Personalização. Use o mesmo espaço com tema claro ou escuro e sua cor de destaque.
Crie uma conta de teste separada com saldo inicial e risco por operação. Registre operações simuladas e acompanhe a curva de capital.
O backtest altera meu diário real?
Inglês e outros 13 idiomas, incluindo árabe com layout da direita para a esquerda.
Filtre o diário e revise dez operações por vez.
Metas, limites de risco e configuração do desafio
Mantenha um registro.
Os detalhes da conta em um só lugar.
Reúna configuração, análise, data, hora, sessão e capturas. Vincule a operação à análise gráfica para comparar plano e execução.
Entenda o que aconteceu.
Tema claro, escuro ou do sistema com troca rápida da esquerda para a direita.
Planos vinculados, resultados e cobertura de capturas
Registre preços, risco, comissão e capturas em Execução. Em Processo, avalie regras, confluências e erros e deixe notas para a próxima revisão.
Não. Contas de teste e operações simuladas são separadas das reais. Confira saldo simulado, curva de capital, fator de lucro, taxa de acerto e resultados sem alterar o diário real.
CONFIGURAÇÕES DO PERFIL
Senha e sincronização manual na mesma aba.
Tamanho de posição padrão
Pratique sem alterar seus resultados reais.
Prepare gráficos, registre operações, teste configurações e revise resultados. Contas e notas de trading ficam juntas.
Fator de lucro, taxa de acerto, R:R médio e resultados.
Resultados
Modos Limite de risco e Duas perdas seguidas
Avaliação de regras em cada operação
Salve a configuração antes de operar.
Conheça os recursos
Desafios separados por conta
Registros separados
Sessões determinadas pelo horário de entrada
Crie um desafio em Configurações da conta. Escolha retorno, duração e nível atual e acompanhe o progresso com Limite de risco ou Duas perdas seguidas.
Defina saldos, moeda, limite de equilíbrio e comissão. Adicione tamanho, metas, limites de perda e desafio nas configurações da conta.
Configuração e análise em um formulário
Operações simuladas não afetam seu saldo nem diário real.
Um ou vários saldos de conta
REGISTRO DE OPERAÇÕES
Teste uma configuração. Personalize seu espaço.
A execução e as decisões por trás dela.
Registro da operação
Histórico de operações
Seções da revisão da operação
Use o diário do seu jeito.
Filtros de ano, mês e semana
Sim. Personalização inclui idioma, fuso, formatos, tema e cores. Inglês é o padrão, com outros 13 idiomas incluindo árabe. A sincronização manual está em Segurança.
Ganho/perda médios`;
rows.it = `Un piano da seguire livello per livello.
DIARIO DI TRADING AAICOREFX
SFIDE DEL CONTO
ANCHE NEL TUO DIARIO
Filtri per conto, strumento, sessione e risultato
Rapporto di rendimento e durata regolabili
TEST STORICI
Operazioni di backtest
Posso cambiare lingua e aspetto?
Scegli lingua, fuso orario e formati in Personalizzazione. Usa lo stesso spazio con tema chiaro o scuro e il tuo colore di accento.
Crea un conto di prova separato con saldo iniziale e rischio per operazione. Registra operazioni simulate e segui la curva del capitale.
Il backtest modifica il mio diario reale?
Inglese e altre 13 lingue, incluso l’arabo con layout da destra a sinistra.
Filtra il diario e rivedi dieci operazioni alla volta.
Obiettivi, limiti di rischio e configurazione della sfida
Tieni un registro.
I dettagli del conto in un solo posto.
Riunisci configurazione, analisi, data, ora, sessione e immagini. Collega l’operazione all’analisi grafica per confrontare piano ed esecuzione.
Comprendi cosa è successo.
Tema chiaro, scuro o di sistema con cambio rapido da sinistra a destra.
Piani collegati, risultati e copertura delle immagini
Registra prezzi, rischio, commissioni e immagini in Esecuzione. In Processo, valuta regole, confluenze ed errori e lascia note per la prossima revisione.
No. Conti di prova e operazioni simulate sono separati da quelli reali. Controlla saldo simulato, curva del capitale, fattore di profitto, tasso di successo e risultati senza modificare il diario reale.
IMPOSTAZIONI DEL PROFILO
Password e sincronizzazione manuale nella stessa scheda.
Dimensionamento predefinito delle posizioni
Esercitati senza cambiare i risultati reali.
Prepara grafici, registra operazioni, prova configurazioni e rivedi risultati. Conti e note di trading restano insieme.
Fattore di profitto, tasso di successo, R:R medio e risultati.
Risultati
Modalità Limite di rischio e Due perdite consecutive
Valutazione delle regole per ogni operazione
Salva la configurazione prima di operare.
Scopri le funzionalità
Sfide separate per ciascun conto
Registri separati
Sessioni determinate dall’ora di ingresso
Crea una sfida nelle impostazioni del conto. Scegli rendimento, durata e livello attuale e segui i progressi con Limite di rischio o Due perdite consecutive.
Imposta saldi, valuta, soglia di pareggio e commissione. Aggiungi dimensionamento, obiettivi, limiti di perdita e sfida dalle impostazioni del conto.
Configurazione e analisi in un modulo
Le operazioni simulate non influenzano saldo o diario reali.
Uno o più saldi di conto
REGISTRO DELLE OPERAZIONI
Prova una configurazione. Personalizza lo spazio.
L’esecuzione e le decisioni che la guidano.
Scheda dell’operazione
Storico delle operazioni
Sezioni di revisione dell’operazione
Usa il diario nel modo che preferisci.
Filtri per anno, mese e settimana
Sì. Personalizzazione include lingua, fuso, formati, tema e colori. Inglese è la lingua predefinita, con altre 13 lingue incluso l’arabo. La sincronizzazione manuale è in Sicurezza.
Guadagno/perdita medi`;
rows.ru = `План, которому можно следовать уровень за уровнем.
ТОРГОВЫЙ ЖУРНАЛ AAICOREFX
ИСПЫТАНИЯ СЧЁТА
ТАКЖЕ В ВАШЕМ ЖУРНАЛЕ
Фильтры по счёту, инструменту, сессии и результату
Настраиваемые соотношение доходности и длина плана
ТЕСТИРОВАНИЕ НА ИСТОРИИ
Тестовые сделки
Можно ли изменить язык и оформление?
Выберите язык, часовой пояс и форматы в Персонализации. Используйте то же пространство со светлой или тёмной темой и своим акцентным цветом.
Создайте отдельный тестовый счёт с начальным балансом и риском на сделку. Записывайте моделируемые сделки и следите за кривой капитала.
Влияет ли тестирование на мой реальный журнал?
Английский и ещё 13 языков, включая арабский с интерфейсом справа налево.
Фильтруйте журнал и проверяйте по десять сделок.
Цели, лимиты риска и настройка испытания
Ведите записи.
Данные счёта в одном месте.
Храните настройку, анализ, дату, время, сессию и снимки вместе. Свяжите сделку с разметкой графика, чтобы сравнить план с исполнением.
Понимайте, что произошло.
Светлая, тёмная или системная тема с быстрым переходом слева направо.
Связанные планы, результаты и полнота снимков
Записывайте цены, риск, комиссию и снимки в Исполнении. В Процессе оценивайте правила, совпадения сигналов и ошибки и оставляйте заметки для следующего обзора.
Нет. Тестовые счета и моделируемые сделки отделены от реальных. Проверяйте тестовый баланс, кривую капитала, фактор прибыли, долю побед и результаты без изменений реального журнала.
НАСТРОЙКИ ПРОФИЛЯ
Пароль и ручная синхронизация на одной вкладке.
Размер позиции по умолчанию
Тренируйтесь без изменения реальных результатов.
Готовьте графики, записывайте сделки, тестируйте настройки и проверяйте результаты. Счета и торговые заметки остаются вместе.
Фактор прибыли, доля побед, среднее R:R и результаты.
Результаты
Режимы Лимит риска и Два убытка подряд
Оценка правил для каждой сделки
Сохраните настройку до входа в сделку.
Посмотрите возможности
Отдельные испытания для каждого счёта
Раздельные записи
Сессии определяются временем входа
Создайте испытание в настройках счёта. Выберите доходность, длину плана и текущий уровень и отслеживайте прогресс в режиме Лимит риска или Два убытка подряд.
Задайте балансы, валюту, порог безубыточности и комиссию. Добавьте размер позиции, цели, лимиты убытка и испытание в настройках счёта.
Настройка и анализ в одной форме
Моделируемые сделки не влияют на реальный баланс и журнал.
Один или несколько балансов счёта
ЖУРНАЛ СДЕЛОК
Проверьте настройку. Сделайте пространство своим.
Исполнение и стоящие за ним решения.
Запись сделки
История сделок
Разделы обзора сделки
Используйте журнал удобным вам способом.
Фильтры по году, месяцу и неделе
Да. Персонализация включает язык, часовой пояс, форматы, тему и цвета. Английский выбран по умолчанию, доступны ещё 13 языков, включая арабский. Ручная синхронизация находится в Безопасности.
Средняя прибыль/убыток`;
rows.zh = `逐级执行的计划。
AAICOREFX 交易日志
账户挑战
日志中的其他功能
按账户、品种、时段和结果筛选
可调整的收益比和计划长度
历史回测
回测交易
可以更改语言和外观吗？
在个性化中选择语言、时区和日期时间格式。同一工作区可使用浅色或深色主题及所选强调色。
创建独立的测试账户，设置初始余额和每笔风险。记录模拟交易并跟踪资金曲线。
回测会更改我的真实交易日志吗？
英语及其他13种语言，包括从右向左布局的阿拉伯语。
筛选日志，每次查看十笔交易。
目标、风险限额和挑战设置
留下记录。
将账户详情放在一起。
保存交易设置、分析、日期、时间、时段和图表截图。将交易关联到图表分析，比较计划与执行。
了解发生了什么。
浅色、深色或系统主题，支持快速从左向右切换。
关联计划、结果和截图覆盖率
在执行中记录价格、风险、佣金和截图。在流程中评估规则、共振因素和错误，并为下次复盘留下笔记。
不会。测试账户和模拟交易与真实账户分离。查看模拟余额、资金曲线、盈利因子、胜率和结果，不影响真实日志。
个人资料设置
密码设置和手动日志同步位于同一标签页。
默认仓位设置
练习而不改变真实交易结果。
准备图表、记录交易、测试策略并复盘结果。账户和交易笔记集中保存。
盈利因子、胜率、平均风险收益比和交易结果。
结果
风险限额和连续两次亏损模式
每笔交易的规则评估
交易前保存设置。
了解功能
各账户独立挑战
独立记录
根据入场时间确定交易时段
在账户设置中创建挑战。选择收益比、计划长度和当前级别，使用风险限额或连续两次亏损模式跟踪进度。
设置余额、货币、保本上限和默认佣金。在账户设置中添加默认仓位、目标、亏损限额和挑战。
在同一表单中设置和分析
模拟交易不影响真实余额和日志。
单个或多个账户余额
交易日志
测试策略，定制工作区。
执行及其背后的决策。
交易记录
交易历史
交易复盘分区
按你的习惯使用日志。
按年、月和周筛选
可以。个性化包含语言、时区、日期时间格式、主题和强调色。默认为英语，另支持13种语言，包括阿拉伯语。手动同步位于安全设置。
平均盈利/亏损`;
rows.ja = `段階ごとに進められる計画。
AAICOREFX トレード日誌
口座チャレンジ
日誌のその他の機能
口座・銘柄・セッション・結果の絞り込み
調整可能な利益比率と計画の長さ
バックテスト
バックテストの取引
言語や外観は変更できますか？
パーソナライズで言語、タイムゾーン、日付と時刻の形式を選択できます。同じワークスペースをライトまたはダークテーマと好きなアクセントカラーで使えます。
初期残高と取引ごとのリスクを設定した独立したテスト口座を作成します。模擬取引を記録し、資産曲線を確認できます。
バックテストは実際の取引日誌に影響しますか？
英語と他の13言語に対応。アラビア語は右から左のレイアウトです。
日誌を絞り込み、10件ずつ取引を確認。
目標・リスク制限・チャレンジ設定
記録を残す。
口座の情報を一か所に。
セットアップ、分析、日時、セッション、チャート画像をまとめて保存。取引とチャート分析を関連付けて計画と実行を比較します。
何が起きたかを知る。
ライト・ダーク・システムテーマに対応し、左から右へ素早く切り替え。
関連する計画・結果・画像の記録率
実行で価格、リスク、手数料、画像を記録。プロセスでルール、根拠の重なり、ミスを確認し、次の振り返りにメモを残します。
いいえ。テスト口座と模擬取引は実際の口座とは別です。模擬残高、資産曲線、プロフィットファクター、勝率、結果を実際の日誌を変えずに確認できます。
プロフィール設定
パスワードと日誌の手動同期を一つのタブに。
ポジションサイズの初期設定
実際の結果を変えずに練習。
チャートを準備し、取引を記録し、セットアップをテストして結果を振り返ります。口座と取引メモをまとめて管理できます。
プロフィットファクター、勝率、平均R:R、取引結果。
結果
リスク制限と2連敗のモード
各取引のルール評価
取引前にセットアップを保存。
機能を見る
口座ごとの独立したチャレンジ
独立した記録
エントリー時刻からセッションを判定
口座設定でチャレンジを作成します。利益比率、計画の長さ、現在のレベルを選び、リスク制限または2連敗モードで進捗を追跡します。
残高、通貨、損益分岐上限、手数料を設定。口座設定でサイズ、目標、損失制限、チャレンジも追加できます。
セットアップと分析を一つのフォームに
模擬取引は実際の残高や日誌に影響しません。
一つまたは複数の口座残高
取引記録
セットアップを試し、自分のワークスペースに。
実行とその背後の判断。
取引の記録
取引履歴
取引の振り返りセクション
読みやすい形で日誌を使う。
年・月・週の絞り込み
はい。パーソナライズに言語、タイムゾーン、日時形式、テーマ、カラーがあります。英語が標準で、アラビア語を含む他13言語に対応。手動同期はセキュリティにあります。
平均利益/損失`;
rows.ko = `단계별로 따라갈 수 있는 계획.
AAICOREFX 트레이딩 일지
계좌 챌린지
일지의 다른 기능
계좌, 종목, 세션, 결과 필터
조정 가능한 수익 비율과 계획 길이
백테스트
백테스트 거래
언어와 모양을 바꿀 수 있나요?
개인 설정에서 언어, 시간대, 날짜와 시간 형식을 선택하세요. 같은 작업 공간을 밝거나 어두운 테마와 원하는 강조색으로 사용하세요.
초기 잔액과 거래당 위험을 설정한 별도 테스트 계좌를 만드세요. 모의 거래를 기록하고 자산 곡선을 확인하세요.
백테스트가 실제 거래 일지를 바꾸나요?
영어와 13개 다른 언어를 지원하며, 아랍어는 오른쪽에서 왼쪽으로 표시됩니다.
일지를 필터링하고 거래를 열 건씩 검토하세요.
목표, 위험 한도, 챌린지 설정
기록을 남기세요.
계좌 정보를 한곳에.
설정, 분석, 날짜, 시간, 세션과 차트 이미지를 함께 보관하세요. 거래를 차트 분석에 연결해 계획과 실행을 비교하세요.
무슨 일이 있었는지 확인하세요.
밝은 테마, 어두운 테마 또는 시스템 테마와 빠른 왼쪽에서 오른쪽 전환.
연결된 계획, 결과, 이미지 기록률
실행에서 가격, 위험, 수수료, 이미지를 기록하세요. 프로세스에서 규칙, 합류 신호, 실수를 평가하고 다음 검토를 위한 메모를 남기세요.
아니요. 테스트 계좌와 모의 거래는 실제 계좌와 분리됩니다. 실제 일지를 바꾸지 않고 모의 잔액, 자산 곡선, 수익 팩터, 승률, 결과를 확인하세요.
프로필 설정
비밀번호와 수동 일지 동기화를 한 탭에.
기본 포지션 크기 설정
실제 결과를 바꾸지 않고 연습하세요.
차트를 준비하고 거래를 기록하고 설정을 테스트하고 결과를 검토하세요. 계좌와 거래 메모를 함께 관리하세요.
수익 팩터, 승률, 평균 R:R 및 거래 결과.
결과
위험 한도 및 연속 두 번 손실 모드
각 거래의 규칙 평가
거래 전에 설정을 저장하세요.
기능 살펴보기
계좌별 독립 챌린지
별도 기록
진입 시간으로 세션 결정
계좌 설정에서 챌린지를 만드세요. 수익 비율, 계획 길이, 현재 단계를 선택하고 위험 한도 또는 연속 두 번 손실 모드로 진행을 추적하세요.
잔액, 통화, 손익분기 한도, 기본 수수료를 설정하세요. 계좌 설정에서 크기, 목표, 손실 한도, 챌린지를 추가하세요.
설정과 분석을 한 양식에
모의 거래는 실제 잔액과 일지에 영향을 주지 않습니다.
단일 또는 여러 계좌 잔액
거래 일지
설정을 테스트하고 작업 공간을 맞춤 설정하세요.
실행과 그 배경의 결정.
거래 기록
거래 내역
거래 검토 섹션
원하는 방식으로 일지를 사용하세요.
연도, 월, 주 필터
네. 개인 설정에 언어, 시간대, 날짜와 시간 형식, 테마, 색상이 있습니다. 영어가 기본이며 아랍어를 포함한 13개 다른 언어를 지원합니다. 수동 동기화는 보안에 있습니다.
평균 이익/손실`;
rows.hi = `स्तर दर स्तर अपनाने योग्य योजना।
AAICOREFX ट्रेडिंग जर्नल
खाता चुनौतियाँ
आपके जर्नल में और भी
खाता, साधन, सत्र और परिणाम के फ़िल्टर
समायोज्य प्रतिफल अनुपात और योजना अवधि
ऐतिहासिक परीक्षण
बैकटेस्ट ट्रेड
क्या भाषा और रूप बदल सकते हैं?
वैयक्तिकरण में भाषा, समय क्षेत्र और तारीख व समय का प्रारूप चुनें। उसी कार्यक्षेत्र में हल्की या गहरी थीम और अपना पसंदीदा रंग उपयोग करें।
शुरुआती शेष और प्रति ट्रेड जोखिम वाला अलग परीक्षण खाता बनाएं। सिमुलेटेड ट्रेड दर्ज करें और पूंजी वक्र देखें।
क्या बैकटेस्ट मेरे वास्तविक जर्नल को बदलता है?
अंग्रेज़ी और 13 अन्य भाषाएँ, अरबी में दाएँ से बाएँ लेआउट सहित।
जर्नल फ़िल्टर करें और एक बार में दस ट्रेड की समीक्षा करें।
लक्ष्य, जोखिम सीमाएँ और चुनौती सेटअप
रिकॉर्ड रखें।
खाते की जानकारी एक जगह रखें।
सेटअप, विश्लेषण, तारीख, समय, सत्र और चार्ट चित्र साथ रखें। ट्रेड को चार्ट विश्लेषण से जोड़कर योजना और निष्पादन की तुलना करें।
जानें क्या हुआ।
हल्की, गहरी या सिस्टम थीम, तेज़ बाएँ से दाएँ बदलाव के साथ।
जुड़ी योजनाएँ, परिणाम और चित्रों की कवरेज
निष्पादन में कीमत, जोखिम, कमीशन और चित्र दर्ज करें। प्रक्रिया में नियम, संगम संकेत और गलतियाँ जांचें और अगली समीक्षा के लिए नोट रखें।
नहीं। परीक्षण खाते और सिमुलेटेड ट्रेड वास्तविक खातों से अलग हैं। वास्तविक जर्नल बदले बिना परीक्षण शेष, पूंजी वक्र, लाभ गुणक, जीत दर और परिणाम देखें।
प्रोफ़ाइल सेटिंग्स
पासवर्ड और मैनुअल जर्नल सिंक एक ही टैब में।
डिफ़ॉल्ट पोज़िशन आकार
वास्तविक परिणाम बदले बिना अभ्यास करें।
चार्ट तैयार करें, ट्रेड दर्ज करें, सेटअप जांचें और परिणाम की समीक्षा करें। खाते और ट्रेडिंग नोट साथ रहते हैं।
लाभ गुणक, जीत दर, औसत R:R और ट्रेड परिणाम।
परिणाम
जोखिम सीमा और लगातार दो नुकसान के मोड
हर ट्रेड के साथ नियम मूल्यांकन
ट्रेड लेने से पहले सेटअप सहेजें।
सुविधाएँ देखें
हर खाते के लिए अलग चुनौती
अलग रिकॉर्ड
प्रवेश समय के अनुसार सत्र
खाता सेटिंग्स में चुनौती बनाएं। प्रतिफल अनुपात, योजना अवधि और वर्तमान स्तर चुनें और जोखिम सीमा या लगातार दो नुकसान के मोड में प्रगति देखें।
शेष, मुद्रा, ब्रेकईवन सीमा और कमीशन तय करें। खाता सेटिंग्स में आकार, लक्ष्य, नुकसान सीमा और चुनौती जोड़ें।
सेटअप और विश्लेषण एक फ़ॉर्म में
सिमुलेटेड ट्रेड वास्तविक शेष या जर्नल को नहीं बदलते।
एक या कई खाता शेष
ट्रेड लॉग
सेटअप जांचें। कार्यक्षेत्र अपना बनाएं।
निष्पादन और उसके पीछे के निर्णय।
ट्रेड रिकॉर्ड
ट्रेड इतिहास
ट्रेड समीक्षा अनुभाग
जर्नल अपनी सुविधा अनुसार उपयोग करें।
साल, महीना और सप्ताह के फ़िल्टर
हाँ। वैयक्तिकरण में भाषा, समय क्षेत्र, प्रारूप, थीम और रंग हैं। अंग्रेज़ी डिफ़ॉल्ट है और अरबी समेत 13 अन्य भाषाएँ हैं। मैनुअल सिंक सुरक्षा में है।
औसत लाभ/हानि`;
rows.tr = `Adım adım izleyebileceğiniz bir plan.
AAICOREFX İŞLEM GÜNLÜĞÜ
HESAP MÜCADELELERİ
GÜNLÜĞÜNÜZDE AYRICA
Hesap, enstrüman, seans ve sonuç filtreleri
Ayarlanabilir getiri oranı ve plan uzunluğu
GEÇMİŞ VERİ TESTİ
Test işlemleri
Dili ve görünümü değiştirebilir miyim?
Kişiselleştirme bölümünde dil, saat dilimi ve tarih-saat biçimlerini seçin. Aynı çalışma alanını açık veya koyu tema ve seçtiğiniz vurgu rengiyle kullanın.
Kendi başlangıç bakiyesi ve işlem başına riski olan ayrı bir test hesabı oluşturun. Simülasyon işlemlerini kaydedin ve sermaye eğrisini izleyin.
Test gerçek işlem günlüğümü değiştirir mi?
İngilizce ve sağdan sola düzenli Arapça dahil 13 başka dil.
Günlüğü filtreleyin ve on işlemi bir arada inceleyin.
Hedefler, risk sınırları ve mücadele ayarları
Kayıt tutun.
Hesap bilgilerini tek yerde tutun.
Kurulum, analiz, tarih, saat, seans ve grafik görüntülerini birlikte saklayın. Plan ve uygulamayı karşılaştırmak için işlemi grafik analizine bağlayın.
Ne olduğunu anlayın.
Açık, koyu veya sistem teması; hızlı soldan sağa geçiş.
Bağlı planlar, sonuçlar ve görüntü kapsamı
Uygulama bölümünde fiyat, risk, komisyon ve görüntüleri kaydedin. Süreçte kuralları, örtüşen sinyalleri ve hataları değerlendirin; sonraki inceleme için not bırakın.
Hayır. Test hesapları ve simülasyon işlemleri gerçek hesaplardan ayrıdır. Gerçek günlüğü değiştirmeden test bakiyesi, sermaye eğrisi, kâr faktörü, kazanma oranı ve sonuçları inceleyin.
PROFİL AYARLARI
Şifre ve manuel günlük eşitleme aynı sekmede.
Varsayılan pozisyon boyutu
Gerçek sonuçları değiştirmeden pratik yapın.
Grafikleri hazırlayın, işlemleri kaydedin, kurulumları test edin ve sonuçları inceleyin. Hesaplar ve işlem notları bir arada kalır.
Kâr faktörü, kazanma oranı, ortalama R:R ve işlem sonuçları.
Sonuçlar
Risk Sınırı ve Art Arda İki Kayıp modları
Her işlem için kural değerlendirmesi
İşleme girmeden kurulumu kaydedin.
Özellikleri keşfedin
Her hesap için ayrı mücadele
Ayrı kayıtlar
Giriş saatinden belirlenen seanslar
Hesap ayarlarından mücadele oluşturun. Getiri oranını, plan uzunluğunu ve mevcut seviyeyi seçin; Risk Sınırı veya Art Arda İki Kayıp moduyla ilerlemeyi izleyin.
Bakiye, para birimi, başabaş sınırı ve komisyonu belirleyin. Hesap ayarlarından boyut, hedefler, kayıp sınırları ve mücadele ekleyin.
Kurulum ve analiz tek formda
Simülasyon işlemleri gerçek bakiye ve günlüğü etkilemez.
Tek veya birden çok hesap bakiyesi
İŞLEM GÜNLÜĞÜ
Kurulumu test edin. Çalışma alanını özelleştirin.
Uygulama ve arkasındaki kararlar.
İşlem kaydı
İşlem geçmişi
İşlem inceleme bölümleri
Günlüğü size uygun şekilde kullanın.
Yıl, ay ve hafta filtreleri
Evet. Kişiselleştirme; dil, saat dilimi, biçimler, tema ve renkleri içerir. İngilizce varsayılandır; Arapça dahil 13 başka dil vardır. Manuel eşitleme Güvenlik bölümündedir.
Ort. kazanç/kayıp`;
rows.id = `Rencana yang bisa diikuti tingkat demi tingkat.
JURNAL TRADING AAICOREFX
TANTANGAN AKUN
JUGA DI JURNAL ANDA
Filter akun, instrumen, sesi, dan hasil
Rasio imbalan dan panjang rencana yang dapat diatur
UJI HISTORIS
Transaksi backtest
Bisakah saya mengubah bahasa dan tampilan?
Pilih bahasa, zona waktu, serta format tanggal dan waktu di Personalisasi. Gunakan ruang kerja yang sama dengan tema terang atau gelap dan warna aksen pilihan.
Buat akun uji terpisah dengan saldo awal dan risiko per transaksi. Catat transaksi simulasi dan pantau kurva ekuitas.
Apakah backtest mengubah jurnal nyata saya?
Bahasa Inggris dan 13 bahasa lainnya, termasuk Arab dengan tata letak kanan ke kiri.
Filter jurnal dan tinjau sepuluh transaksi sekaligus.
Target, batas risiko, dan pengaturan tantangan
Simpan catatan.
Detail akun di satu tempat.
Simpan setup, analisis, tanggal, waktu, sesi, dan gambar grafik bersama. Hubungkan transaksi dengan analisis grafik untuk membandingkan rencana dan pelaksanaan.
Pahami apa yang terjadi.
Tema terang, gelap, atau sistem dengan pergantian cepat dari kiri ke kanan.
Rencana terhubung, hasil, dan cakupan gambar
Catat harga, risiko, komisi, dan gambar di Eksekusi. Di Proses, nilai aturan, konfluensi, dan kesalahan, serta buat catatan untuk tinjauan berikutnya.
Tidak. Akun uji dan transaksi simulasi terpisah dari akun nyata. Tinjau saldo simulasi, kurva ekuitas, faktor profit, tingkat kemenangan, dan hasil tanpa mengubah jurnal nyata.
PENGATURAN PROFIL
Kata sandi dan sinkronisasi jurnal manual di satu tab.
Ukuran posisi bawaan
Berlatih tanpa mengubah hasil nyata.
Siapkan grafik, catat transaksi, uji setup, dan tinjau hasil. Akun dan catatan trading tetap bersama.
Faktor profit, tingkat kemenangan, R:R rata-rata, dan hasil transaksi.
Hasil
Mode Batas Risiko dan Dua Kerugian Beruntun
Evaluasi aturan pada setiap transaksi
Simpan setup sebelum melakukan transaksi.
Lihat fitur
Tantangan terpisah untuk setiap akun
Catatan terpisah
Sesi ditentukan dari waktu masuk
Buat tantangan di Pengaturan Akun. Pilih rasio imbalan, panjang rencana, dan tingkat saat ini; pantau kemajuan dengan Batas Risiko atau Dua Kerugian Beruntun.
Atur saldo, mata uang, batas impas, dan komisi. Tambahkan ukuran, target, batas kerugian, dan tantangan di Pengaturan Akun.
Setup dan analisis dalam satu formulir
Transaksi simulasi tidak memengaruhi saldo dan jurnal nyata.
Saldo satu atau beberapa akun
LOG TRANSAKSI
Uji setup. Sesuaikan ruang kerja Anda.
Eksekusi dan keputusan di baliknya.
Catatan transaksi
Riwayat transaksi
Bagian tinjauan transaksi
Gunakan jurnal sesuai cara Anda.
Filter tahun, bulan, dan minggu
Ya. Personalisasi mencakup bahasa, zona waktu, format, tema, dan warna. Inggris adalah bawaan, dengan 13 bahasa lainnya termasuk Arab. Sinkronisasi manual ada di Keamanan.
Rata-rata untung/rugi`;
for (const [locale,text] of Object.entries(rows)) {
  if (text.split('\n').length !== sources.length) throw new Error(`Incomplete translation catalog: ${locale}`);
}
export const auditMessages = Object.fromEntries(sources.map((source,index) => [source,Object.fromEntries(Object.entries(rows).map(([locale,text]) => [locale,text.split('\n')[index]]))]));
Object.assign(auditMessages,savingsCardMessages);
Object.assign(auditMessages,landingMessages);
auditMessages['Not Executed']={es:'No ejecutado',fr:'Non exécuté',de:'Nicht ausgeführt',pt:'Não executado',it:'Non eseguito',ja:'未実行',ko:'미실행',ru:'Не исполнено',tr:'İşlem yapılmadı',ar:'لم يُنفذ',hi:'निष्पादित नहीं',zh:'未执行',id:'Tidak dieksekusi'};
auditMessages['Some expired markups could not be marked Not Executed. They will be retried automatically.']={es:'No se pudieron marcar algunos planes vencidos como no ejecutados. Se reintentará automáticamente.',fr:'Certains plans expirés n’ont pas pu être marqués comme non exécutés. Une nouvelle tentative sera automatique.',de:'Einige abgelaufene Pläne konnten nicht als nicht ausgeführt markiert werden. Der Vorgang wird automatisch wiederholt.',pt:'Alguns planos expirados não puderam ser marcados como não executados. Haverá uma nova tentativa automática.',it:'Alcuni piani scaduti non sono stati contrassegnati come non eseguiti. Il tentativo verrà ripetuto automaticamente.',ja:'期限切れの一部のプランを未実行に変更できませんでした。自動的に再試行します。',ko:'만료된 일부 계획을 미실행으로 표시하지 못했습니다. 자동으로 다시 시도합니다.',ru:'Некоторые истёкшие планы не удалось отметить как неисполненные. Попытка будет повторена автоматически.',tr:'Süresi dolan bazı planlar işlem yapılmadı olarak işaretlenemedi. Otomatik olarak yeniden denenecek.',ar:'تعذر وضع علامة لم يُنفذ على بعض الخطط المنتهية. ستتم إعادة المحاولة تلقائيًا.',hi:'कुछ समाप्त योजनाओं को निष्पादित नहीं के रूप में चिह्नित नहीं किया जा सका। स्वतः पुनः प्रयास होगा।',zh:'部分已过期计划无法标记为未执行。系统将自动重试。',id:'Beberapa rencana kedaluwarsa tidak dapat ditandai sebagai tidak dieksekusi. Akan dicoba lagi secara otomatis.'};
auditMessages['done today']={es:'hecho hoy',fr:'fait aujourd’hui',de:'heute erledigt',pt:'feito hoje',it:'completata oggi',ja:'今日は完了',ko:'오늘 완료',ru:'выполнено сегодня',tr:'bugün tamamlandı',ar:'مكتمل اليوم',hi:'आज पूरा हुआ',zh:'今日已完成',id:'selesai hari ini'};
auditMessages['not done today']={es:'pendiente hoy',fr:'pas encore fait aujourd’hui',de:'heute noch offen',pt:'pendente hoje',it:'da completare oggi',ja:'今日は未完了',ko:'오늘 미완료',ru:'сегодня не выполнено',tr:'bugün tamamlanmadı',ar:'غير مكتمل اليوم',hi:'आज पूरा नहीं हुआ',zh:'今日未完成',id:'belum selesai hari ini'};
auditMessages['Quiet weeks']={es:'Semanas tranquilas',fr:'Semaines calmes',de:'Ruhige Wochen',pt:'Semanas tranquilas',it:'Settimane tranquille',ja:'静かな週',ko:'조용한 주간',ru:'Спокойные недели',tr:'Sakin haftalar',ar:'أسابيع هادئة',hi:'शांत सप्ताह',zh:'平静的周',id:'Minggu tenang'};
auditMessages.Metrics = {es:'Métricas',fr:'Indicateurs',de:'Kennzahlen',pt:'Métricas',it:'Metriche',ja:'指標',ko:'지표',ru:'Метрики',tr:'Metrikler',ar:'المقاييس',hi:'मेट्रिक्स',zh:'指标',id:'Metrik'};
auditMessages.Only = {es:'Solo',fr:'Seul',de:'Nur',pt:'Somente',it:'Solo',ja:'のみ',ko:'오직',ru:'Только',tr:'Yalnızca',ar:'فقط',hi:'केवल',zh:'仅',id:'Hanya'};
auditMessages['stays in this workspace.'] = {es:'permanece en este espacio de trabajo.',fr:'reste dans cet espace de travail.',de:'bleibt in diesem Arbeitsbereich.',pt:'permanece neste espaço de trabalho.',it:'rimane in questo spazio di lavoro.',ja:'がこのワークスペースに残ります。',ko:'이 작업 공간에 남습니다.',ru:'остаётся в этом рабочем пространстве.',tr:'bu çalışma alanında kalır.',ar:'يبقى في مساحة العمل هذه.',hi:'इस कार्यस्थान में रहता है।',zh:'保留在此工作区。',id:'tetap di ruang kerja ini.'};
auditMessages['and its trades'] = {es:'y sus operaciones',fr:'et ses transactions',de:'und seine Trades',pt:'e suas operações',it:'e le sue operazioni',ja:'とその取引',ko:'및 해당 거래',ru:'и его сделки',tr:'ve işlemleri',ar:'وصفقاته',hi:'और उसके ट्रेड',zh:'及其交易',id:'dan transaksinya'};
auditMessages['Trades shared with'] = {es:'Operaciones compartidas con',fr:'Transactions partagées avec',de:'Geteilte Trades mit',pt:'Operações compartilhadas com',it:'Operazioni condivise con',ja:'共有されている取引：',ko:'공유된 거래:',ru:'Сделки, общие с',tr:'Paylaşılan işlemler:',ar:'الصفقات المشتركة مع',hi:'इनके साथ साझा ट्रेड',zh:'共享交易账户：',id:'Transaksi bersama dengan'};
auditMessages['· they keep only'] = {es:'· conservan solo',fr:'· elles conservent uniquement',de:'· sie behalten nur',pt:'· mantêm somente',it:'· mantengono solo',ja:'· 保持されるのは',ko:'· 다음 항목만 유지:',ru:'· сохраняют только',tr:'· yalnızca şunu korurlar:',ar:'· تحتفظ فقط بـ',hi:'· वे केवल रखते हैं',zh:'· 仅保留',id:'· hanya menyimpan'};
auditMessages['Profit since your last cash movement is ready to move.'] = {es:'El beneficio desde tu último movimiento de efectivo está listo para transferirse.',fr:'Le bénéfice depuis votre dernier mouvement de trésorerie est prêt à être transféré.',de:'Der Gewinn seit deiner letzten Geldbewegung ist zur Übertragung bereit.',pt:'O lucro desde sua última movimentação está pronto para transferência.',it:'Il profitto dall’ultimo movimento di cassa è pronto per il trasferimento.',ja:'前回の資金移動以降の利益を移動できます。',ko:'마지막 자금 이동 이후의 수익을 이체할 수 있습니다.',ru:'Прибыль с последнего движения средств готова к переводу.',tr:'Son nakit hareketinizden bu yana elde edilen kâr aktarıma hazır.',ar:'الربح منذ آخر حركة نقدية جاهز للتحويل.',hi:'आपकी पिछली नकद गतिविधि के बाद का लाभ हस्तांतरण के लिए तैयार है।',zh:'自上次资金变动以来的利润已可转移。',id:'Keuntungan sejak pergerakan kas terakhir siap dipindahkan.'};
auditMessages['Release alert'] = {es:'Alerta de publicación',fr:'Alerte de publication',de:'Veröffentlichungsalarm',pt:'Alerta de divulgação',it:'Avviso di pubblicazione',ja:'発表アラート',ko:'발표 알림',ru:'Оповещение о публикации',tr:'Yayın uyarısı',ar:'تنبيه الإصدار',hi:'रिलीज़ अलर्ट',zh:'发布提醒',id:'Peringatan rilis'};
auditMessages['min before'] = {es:'min antes',fr:'min avant',de:'Min. vorher',pt:'min antes',it:'min prima',ja:'分前',ko:'분 전',ru:'мин. до',tr:'dk önce',ar:'دقائق قبل',hi:'मिनट पहले',zh:'分钟前',id:'menit sebelum'};
auditMessages['Jump to active level'] = {es:'Ir al nivel activo',fr:'Aller au niveau actif',de:'Zur aktiven Stufe',pt:'Ir ao nível ativo',it:'Vai al livello attivo',ja:'現在のレベルへ',ko:'활성 단계로 이동',ru:'К активному уровню',tr:'Aktif seviyeye git',ar:'انتقل إلى المستوى النشط',hi:'सक्रिय स्तर पर जाएँ',zh:'跳转到当前级别',id:'Ke level aktif'};
auditMessages['Save status'] = {es:'Guardar estado',fr:'Enregistrer le statut',de:'Status speichern',pt:'Salvar status',it:'Salva stato',ja:'状態を保存',ko:'상태 저장',ru:'Сохранить статус',tr:'Durumu kaydet',ar:'حفظ الحالة',hi:'स्थिति सहेजें',zh:'保存状态',id:'Simpan status'};
auditMessages['Save & open trade →'] = {es:'Guardar y abrir operación →',fr:'Enregistrer et ouvrir le trade →',de:'Speichern und Trade öffnen →',pt:'Salvar e abrir operação →',it:'Salva e apri operazione →',ja:'保存して取引フォームを開く →',ko:'저장하고 거래 열기 →',ru:'Сохранить и открыть сделку →',tr:'Kaydet ve işlemi aç →',ar:'حفظ وفتح الصفقة ←',hi:'सहेजें और ट्रेड खोलें →',zh:'保存并打开交易 →',id:'Simpan dan buka transaksi →'};
auditMessages['Everything is ticked. Your trade form is one click away.'] = {es:'Todo está marcado. Tu formulario de operación está a un clic.',fr:'Tout est coché. Votre formulaire de trade est à un clic.',de:'Alles ist abgehakt. Dein Trade-Formular ist nur einen Klick entfernt.',pt:'Tudo marcado. Seu formulário de operação está a um clique.',it:'Tutto spuntato. Il modulo di trading è a un clic.',ja:'すべてチェック済みです。ワンクリックで取引フォームを開けます。',ko:'모두 체크했습니다. 클릭 한 번으로 거래 양식을 열 수 있습니다.',ru:'Всё отмечено. Форма сделки доступна одним нажатием.',tr:'Her şey işaretlendi. İşlem formunuz bir tık uzakta.',ar:'اكتملت جميع العلامات. نموذج الصفقة على بُعد نقرة واحدة.',hi:'सभी मदों पर निशान लगा है। ट्रेड फ़ॉर्म एक क्लिक दूर है।',zh:'已全部勾选。点击即可打开交易表单。',id:'Semua sudah dicentang. Formulir transaksi tinggal satu klik.'};
auditMessages['first markup or trade of the day'] = {es:'primer análisis u operación del día',fr:'première analyse ou premier trade de la journée',de:'ersten Markup oder Trade des Tages',pt:'primeira análise ou operação do dia',it:'prima analisi o operazione del giorno',ja:'その日最初の分析または取引',ko:'하루의 첫 분석 또는 거래',ru:'первой разметкой или сделкой дня',tr:'günün ilk analizinden veya işleminden önce',ar:'أول تحليل أو صفقة في اليوم',hi:'दिन के पहले विश्लेषण या ट्रेड',zh:'当天首次分析或交易',id:'analisis atau transaksi pertama hari ini'};
auditMessages['Opens a short checklist before your first markup or trade each day. It comes back when the Tokyo session opens.'] = {es:'Abre una breve lista antes de tu primer análisis u operación del día. Vuelve al abrir la sesión de Tokio.',fr:'Ouvre une courte liste avant votre première analyse ou votre premier trade du jour. Elle revient à l’ouverture de Tokyo.',de:'Öffnet eine kurze Checkliste vor dem ersten Markup oder Trade des Tages. Sie kehrt zum Start der Tokio-Sitzung zurück.',pt:'Abre uma lista curta antes da primeira análise ou operação do dia. Ela retorna na abertura da sessão de Tóquio.',it:'Apre una breve lista prima della prima analisi o operazione del giorno. Ricompare all’apertura di Tokyo.',ja:'毎日の最初の分析または取引の前に短いチェックリストを開きます。東京セッション開始時に再表示されます。',ko:'매일 첫 분석 또는 거래 전에 간단한 체크리스트가 열립니다. 도쿄 세션이 시작되면 다시 표시됩니다.',ru:'Открывает короткий список перед первой разметкой или сделкой дня. Появляется снова при открытии сессии Токио.',tr:'Günün ilk analizinden veya işleminden önce kısa bir kontrol listesi açar. Tokyo seansı açıldığında yeniden görünür.',ar:'يفتح قائمة قصيرة قبل أول تحليل أو صفقة كل يوم. تظهر مجددًا عند افتتاح جلسة طوكيو.',hi:'हर दिन पहले विश्लेषण या ट्रेड से पहले छोटी चेकलिस्ट खोलता है। टोक्यो सत्र खुलने पर यह फिर दिखाई देती है।',zh:'每天首次分析或交易前打开简短清单。东京交易时段开始时再次出现。',id:'Membuka daftar singkat sebelum analisis atau transaksi pertama setiap hari. Muncul kembali saat sesi Tokyo dibuka.'};
auditMessages['Markups and trades open straight to their entry forms. Switch on to get a daily checklist first.'] = {es:'Los análisis y operaciones abren sus formularios directamente. Activa la rutina para ver primero la lista diaria.',fr:'Les analyses et trades ouvrent directement leur formulaire. Activez la routine pour voir d’abord la liste quotidienne.',de:'Markups und Trades öffnen direkt das Eingabeformular. Aktiviere die Routine für die tägliche Checkliste davor.',pt:'Análises e operações abrem seus formulários diretamente. Ative a rotina para ver a lista diária primeiro.',it:'Analisi e operazioni aprono direttamente i moduli. Attiva la routine per visualizzare prima la lista giornaliera.',ja:'分析と取引の入力フォームを直接開きます。有効にすると先に毎日のチェックリストを表示します。',ko:'분석과 거래의 입력 양식이 바로 열립니다. 켜면 일일 체크리스트가 먼저 표시됩니다.',ru:'Разметки и сделки открывают форму напрямую. Включите рутину, чтобы сначала видеть ежедневный список.',tr:'Analizler ve işlemler doğrudan giriş formunu açar. Önce günlük listeyi görmek için rutini açın.',ar:'تفتح التحليلات والصفقات نماذج الإدخال مباشرة. فعّل الروتين لعرض القائمة اليومية أولًا.',hi:'विश्लेषण और ट्रेड सीधे अपने फ़ॉर्म खोलते हैं। पहले दैनिक चेकलिस्ट देखने के लिए इसे चालू करें।',zh:'分析和交易将直接打开录入表单。启用后会先显示每日清单。',id:'Analisis dan transaksi langsung membuka formulirnya. Aktifkan untuk menampilkan daftar harian terlebih dahulu.'};
auditMessages['Markups and trades open straight to their entry forms. Switch the routine on in Profile settings to use this checklist.'] = {es:'Los análisis y operaciones abren sus formularios directamente. Activa la rutina en Perfil para usar esta lista.',fr:'Les analyses et trades ouvrent directement leur formulaire. Activez la routine dans le profil pour utiliser cette liste.',de:'Markups und Trades öffnen direkt das Eingabeformular. Aktiviere die Routine im Profil, um diese Checkliste zu nutzen.',pt:'Análises e operações abrem seus formulários diretamente. Ative a rotina no Perfil para usar esta lista.',it:'Analisi e operazioni aprono direttamente i moduli. Attiva la routine nel profilo per usare questa lista.',ja:'分析と取引の入力フォームを直接開きます。このチェックリストを使うにはプロフィール設定でルーティンを有効にしてください。',ko:'분석과 거래의 입력 양식이 바로 열립니다. 이 체크리스트를 사용하려면 프로필 설정에서 루틴을 켜세요.',ru:'Разметки и сделки открывают форму напрямую. Включите рутину в настройках профиля для использования списка.',tr:'Analizler ve işlemler doğrudan giriş formunu açar. Bu listeyi kullanmak için Profil ayarlarında rutini açın.',ar:'تفتح التحليلات والصفقات نماذج الإدخال مباشرة. فعّل الروتين في إعدادات الملف الشخصي لاستخدام القائمة.',hi:'विश्लेषण और ट्रेड सीधे अपने फ़ॉर्म खोलते हैं। यह चेकलिस्ट उपयोग करने के लिए प्रोफ़ाइल सेटिंग में रूटीन चालू करें।',zh:'分析和交易将直接打开录入表单。在个人资料设置中启用日常流程即可使用此清单。',id:'Analisis dan transaksi langsung membuka formulirnya. Aktifkan rutinitas di pengaturan Profil untuk memakai daftar ini.'};
auditMessages['Deposit-funded levels are not trading passes'] = {es:'Los niveles financiados con depósitos no cuentan como aprobados por operaciones',fr:'Les niveaux financés par dépôt ne comptent pas comme réussites de trading',de:'Durch Einzahlungen finanzierte Stufen sind keine Trading-Erfolge',pt:'Níveis financiados por depósitos não contam como aprovações de trading',it:'I livelli finanziati da depositi non sono superamenti tramite trading',ja:'入金で到達したレベルは取引による達成ではありません',ko:'입금으로 도달한 단계는 거래 통과가 아닙니다',ru:'Уровни за счёт пополнений не считаются торговыми достижениями',tr:'Yatırımla ulaşılan seviyeler işlem başarısı sayılmaz',ar:'المستويات الممولة بالإيداع لا تُعد نجاحات تداول',hi:'जमा से प्राप्त स्तर ट्रेडिंग की सफलताएँ नहीं हैं',zh:'入金达到的级别不算交易通关',id:'Level yang dicapai melalui setoran bukan kelulusan trading'};
