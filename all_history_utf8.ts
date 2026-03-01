commit ef68e82b55fdbea7194e8497371efde611df0695
Author: Fernando Souza <fernando10frango@gmail.com>
Date:   Sun Mar 1 02:30:24 2026 -0300

    feat: Implement initial WMS application structure including Electron integration, user authentication, various views, and services.

diff --git a/services/gamificationService.ts b/services/gamificationService.ts
index cf6a14d..7bc86e6 100644
--- a/services/gamificationService.ts
+++ b/services/gamificationService.ts
@@ -279,7 +279,9 @@ export class GamificationService {
         if (monthlyScans >= 1000) await unlock('scans_1000');
         if (zeroErrorDays >= 30) await unlock('zero_errors_30');
         if (isTop3Weekly) await unlock('top3_weekly');
-        if (avgMetaPercent >= 110) await unlock('avg_110');
+
+        // Desativar badge "Supera├º├úo" no primeiro dia do m├¬s; s├│ calcular se tiver hist├│rico consolidado
+        if (avgMetaPercent >= 110 && extra?.activeDays > 1) await unlock('avg_110');
 
         if (extra) {
             if (extra.inventoryParticipations >= 12) await unlock('dr_inventario');

commit 01450d6c8164eede0bd135dbd2212c9e281355e0
Author: Fernando Souza <fernando10frango@gmail.com>
Date:   Wed Feb 25 22:53:15 2026 -0300

    feat: Implement core WMS application with new views, UI components, services, and utilities.

diff --git a/services/gamificationService.ts b/services/gamificationService.ts
index 3c02b2f..cf6a14d 100644
--- a/services/gamificationService.ts
+++ b/services/gamificationService.ts
@@ -100,11 +100,9 @@ export class GamificationService {
 
             const data = apiResult.data;
 
-            if (error) throw error;
-
-            if (data) {
+            if (apiResult.data) {
                 this.profiles.clear();
-                data.forEach((p: any) => {
+                apiResult.data.forEach((p: any) => {
                     this.profiles.set(p.user_name, {
                         userId: p.user_id,
                         userName: p.user_name,
@@ -219,6 +217,7 @@ export class GamificationService {
         consecutiveDays: number,
         zeroErrorDays: number,
         avgMetaPercent: number,
+        currentUser: User,
         extraMetrics?: any,
         skipSave: boolean = false
     ): Promise<GamificationProfile> {
@@ -254,7 +253,7 @@ export class GamificationService {
         }
 
         if (!skipSave) {
-            await this.save(userId, userName, companyId);
+            await this.save(userId, userName, currentUser);
         }
         return profile;
     }
@@ -296,7 +295,7 @@ export class GamificationService {
         }
     }
 
-    async registerScan(userId: string, userName: string, companyId: string): Promise<{ suspicious: boolean; reason?: string }> {
+    async registerScan(userId: string, userName: string, currentUser: User): Promise<{ suspicious: boolean; reason?: string }> {
         const profile = this.ensureProfile(userId, userName);
         const now = Date.now();
 
@@ -311,20 +310,20 @@ export class GamificationService {
             if (span < 2) { // 2 seconds for 10 scans is inhumanly fast
                 profile.fraudAlerts.push(`${getSaoPauloIso()} - Velocidade suspeita: ${(10 / span).toFixed(1)} scans/s`);
                 profile.fraudFlag = true;
-                await this.save(userId, userName, companyId);
+                await this.save(userId, userName, currentUser);
                 return { suspicious: true, reason: 'Velocidade de scan suspeita detectada' };
             }
         }
 
-        await this.save(userId, userName, companyId);
+        await this.save(userId, userName, currentUser);
         return { suspicious: false };
     }
 
-    async clearFraudFlag(userId: string, userName: string, companyId: string): Promise<void> {
+    async clearFraudFlag(userId: string, userName: string, currentUser: User): Promise<void> {
         const profile = this.profiles.get(userName);
         if (profile) {
             profile.fraudFlag = false;
-            await this.save(userId, userName, companyId);
+            await this.save(userId, userName, currentUser);
         }
     }
 

commit 8ccf83f90d64d16b26dbc2a70c3b51d2a645fd0b
Author: Fernando Souza <fernando10frango@gmail.com>
Date:   Wed Feb 25 22:52:29 2026 -0300

    feat: Implement initial WMS application structure including authentication, multiple operational views, and service integrations.

diff --git a/services/gamificationService.ts b/services/gamificationService.ts
index 2fa4c13..3c02b2f 100644
--- a/services/gamificationService.ts
+++ b/services/gamificationService.ts
@@ -1,5 +1,6 @@
-import { supabase } from './supabase';
 import { getSaoPauloIso } from '../utils/dateUtils';
+import { ApiService } from './apiService';
+import { User } from '../types';
 
 export interface GamificationLevel {
     name: string;
@@ -91,12 +92,13 @@ export class GamificationService {
     private profiles: Map<string, GamificationProfile> = new Map();
     private initialized: boolean = false;
 
-    async init(companyId?: string): Promise<void> {
+    async init(currentUser: User): Promise<void> {
         try {
-            let query = supabase.from('gamification_profiles').select('*');
-            if (companyId) query = query.eq('company_id', companyId);
+            const apiResult = await ApiService.getGamificationProfiles(currentUser);
 
-            const { data, error } = await query;
+            if (!apiResult.success) throw new Error(apiResult.error);
+
+            const data = apiResult.data;
 
             if (error) throw error;
 
@@ -128,7 +130,7 @@ export class GamificationService {
         }
     }
 
-    private async save(userId: string, userName: string, companyId: string): Promise<void> {
+    private async save(userId: string, userName: string, currentUser: User): Promise<void> {
         const profile = this.profiles.get(userName);
         if (!profile) return;
 
@@ -141,15 +143,11 @@ export class GamificationService {
             spr_monthly: profile.sprMonthly,
             badges: profile.badges,
             fraud_flag: profile.fraudFlag,
-            fraud_alerts: profile.fraudAlerts,
-            company_id: companyId
+            fraud_alerts: profile.fraudAlerts
         };
 
-        const { error } = await supabase
-            .from('gamification_profiles')
-            .upsert(dbProfile);
-
-        if (error) console.error("Gamification save failed", error);
+        const result = await ApiService.saveGamificationProfile(dbProfile, currentUser);
+        if (!result.success) console.error("Gamification save failed", result.error);
     }
 
     async getProfile(userName: string): Promise<GamificationProfile | undefined> {

commit e3b9a8bf0c85d29471298b86c739cfb19743ab19
Author: Fernando Souza <fernando10frango@gmail.com>
Date:   Wed Feb 25 01:26:53 2026 -0300

    feat: create WmsContext to centralize state management and business logic for WMS operations.

diff --git a/services/gamificationService.ts b/services/gamificationService.ts
index 51b3fa5..2fa4c13 100644
--- a/services/gamificationService.ts
+++ b/services/gamificationService.ts
@@ -91,12 +91,12 @@ export class GamificationService {
     private profiles: Map<string, GamificationProfile> = new Map();
     private initialized: boolean = false;
 
-    async init(companyId: string): Promise<void> {
+    async init(companyId?: string): Promise<void> {
         try {
-            const { data, error } = await supabase
-                .from('gamification_profiles')
-                .select('*')
-                .eq('company_id', companyId);
+            let query = supabase.from('gamification_profiles').select('*');
+            if (companyId) query = query.eq('company_id', companyId);
+
+            const { data, error } = await query;
 
             if (error) throw error;
 

commit 80419f765efca3363d9002ccfc55658bc5223050
Author: Fernando Souza <fernando10frango@gmail.com>
Date:   Mon Feb 23 22:54:41 2026 -0300

    feat: Implement WMS context for centralized state management and introduce gamification service.

diff --git a/services/gamificationService.ts b/services/gamificationService.ts
index 1c8272a..51b3fa5 100644
--- a/services/gamificationService.ts
+++ b/services/gamificationService.ts
@@ -142,8 +142,7 @@ export class GamificationService {
             badges: profile.badges,
             fraud_flag: profile.fraudFlag,
             fraud_alerts: profile.fraudAlerts,
-            company_id: companyId,
-            updated_at: getSaoPauloIso()
+            company_id: companyId
         };
 
         const { error } = await supabase

commit 7afb2088aac86cf15d78745338526c862dfe011f
Author: Fernando Souza <fernando10frango@gmail.com>
Date:   Sun Feb 22 22:45:28 2026 -0300

    feat: Implement gamification service with profile management, level calculation, and achievements, along with a new GamificationView.

diff --git a/services/gamificationService.ts b/services/gamificationService.ts
index 7d8ec24..1c8272a 100644
--- a/services/gamificationService.ts
+++ b/services/gamificationService.ts
@@ -65,26 +65,26 @@ export const LEVELS: GamificationLevel[] = [
     { name: 'Esmeralda', minXP: 12000, color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', borderColor: 'border-emerald-400', icon: 'verified' },
     { name: 'Diamante', minXP: 18000, color: 'text-blue-400', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-400', icon: 'diamond' },
     { name: 'Mestre', minXP: 25000, color: 'text-purple-400', bgColor: 'bg-purple-500/20', borderColor: 'border-purple-400', icon: 'stars' },
-    { name: 'Gr├úo-Mestre', minXP: 35000, color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-400', icon: 'local_fire_department' },
+    { name: 'Gr\u00e3o-Mestre', minXP: 35000, color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-400', icon: 'local_fire_department' },
     { name: 'Desafiante', minXP: 45000, color: 'text-yellow-300', bgColor: 'bg-gradient-to-r from-black to-yellow-900/40', borderColor: 'border-yellow-400', icon: 'military_tech' },
 ];
 
 const DEFAULT_ACHIEVEMENTS: Achievement[] = [
-    { id: 'streak_10', title: 'Consist├¬ncia de Ferro', description: '10 dias consecutivos acima da meta', icon: 'whatshot', unlocked: false },
-    { id: 'scans_1000', title: 'Scanner Mestre', description: '1.000 scans no m├¬s', icon: 'inventory_2', unlocked: false },
+    { id: 'streak_10', title: 'Consist\u00eancia de Ferro', description: '10 dias consecutivos acima da meta', icon: 'whatshot', unlocked: false },
+    { id: 'scans_1000', title: 'Scanner Mestre', description: '1.000 scans no m\u00eas', icon: 'inventory_2', unlocked: false },
     { id: 'zero_errors_30', title: 'Perfei├º├úo', description: '0 erros por 30 dias', icon: 'auto_awesome', unlocked: false },
-    { id: 'top3_weekly', title: 'P├│dio Semanal', description: 'Top 3 no ranking do per├¡odo', icon: 'military_tech', unlocked: false },
-    { id: 'avg_110', title: 'Supera├º├úo', description: '110% meta m├®dia no m├¬s', icon: 'speed', unlocked: false },
-    { id: 'dr_inventario', title: 'Doutor Invent├írio', description: 'Participar de 12 invent├írios c├¡clicos', icon: 'fact_check', unlocked: false },
-    { id: 'participacao_ativa', title: 'Participa├º├úo Ativa', description: 'Bipar pacotes 24 dias no m├¬s', icon: 'calendar_month', unlocked: false },
-    { id: 'protetor_pacotes', title: 'Protetor de Pacotes', description: '50 tratativas no m├¬s', icon: 'verified_user', unlocked: false },
-    { id: 'investigador', title: 'O Investigador', description: 'Achar 50 poss├¡veis perdas no m├¬s', icon: 'manage_search', unlocked: false },
-    { id: 'expedidor_mestre', title: 'Expedidor Mestre', description: 'Expedir 120 motoristas no m├¬s', icon: 'local_shipping', unlocked: false },
-    { id: 'scanner_lendario', title: 'Scanner Lend├írio', description: '10.000 scans no m├¬s', icon: 'stars', unlocked: false },
+    { id: 'top3_weekly', title: 'P\u00f3dio Semanal', description: 'Top 3 no ranking do per\u00edodo', icon: 'military_tech', unlocked: false },
+    { id: 'avg_110', title: 'Supera\u00e7\u00e3o', description: '110% meta m\u00e9dia no m\u00eas', icon: 'speed', unlocked: false },
+    { id: 'dr_inventario', title: 'Doutor Invent\u00e1rio', description: 'Participar de 12 invent\u00e1rios c\u00edclicos', icon: 'fact_check', unlocked: false },
+    { id: 'participacao_ativa', title: 'Participa\u00e7\u00e3o Ativa', description: 'Bipar pacotes 24 dias no m\u00eas', icon: 'calendar_month', unlocked: false },
+    { id: 'protetor_pacotes', title: 'Protetor de Pacotes', description: '50 tratativas no m\u00eas', icon: 'verified_user', unlocked: false },
+    { id: 'investigador', title: 'O Investigador', description: 'Achar 50 poss\u00edveis perdas no m\u00eas', icon: 'manage_search', unlocked: false },
+    { id: 'expedidor_mestre', title: 'Expedidor Mestre', description: 'Expedir 120 motoristas no m\u00eas', icon: 'local_shipping', unlocked: false },
+    { id: 'scanner_lendario', title: 'Scanner Lend\u00e1rio', description: '10.000 scans no m\u00eas', icon: 'stars', unlocked: false },
     { id: 'proativo', title: 'O Proativo', description: '20 dias com Entrada+Sa├¡da+Invent├írio', icon: 'bolt', unlocked: false },
-    { id: 'mestre_ps', title: 'Mestre do PS', description: '100 incidentes registrados no m├¬s', icon: 'assignment_late', unlocked: false },
-    { id: 'mestre_reversa', title: 'Mestre da Reversa', description: 'Expedir 20 pallets de reversa no m├¬s', icon: 'sync_alt', unlocked: false },
-    { id: 'incansavel', title: 'O Incans├ível', description: '30.000 scans no m├¬s', icon: 'battery_full', unlocked: false },
+    { id: 'mestre_ps', title: 'Mestre do PS', description: '100 incidentes registrados no m\u00eas', icon: 'assignment_late', unlocked: false },
+    { id: 'mestre_reversa', title: 'Mestre da Reversa', description: 'Expedir 20 pallets de reversa no m\u00eas', icon: 'sync_alt', unlocked: false },
+    { id: 'incansavel', title: 'O Incans\u00e1vel', description: '30.000 scans no m\u00eas', icon: 'battery_full', unlocked: false },
 ];
 
 export class GamificationService {

commit 374a8295619030d0df0045e3e19704b5cebc8a4a
Author: Fernando Souza <fernando10frango@gmail.com>
Date:   Sun Feb 22 03:07:03 2026 -0300

    feat: Add WMS context for managing warehouse operations and introduce gamification view.

diff --git a/services/gamificationService.ts b/services/gamificationService.ts
index 278bd7f..7d8ec24 100644
--- a/services/gamificationService.ts
+++ b/services/gamificationService.ts
@@ -46,6 +46,7 @@ export interface GamificationProfile {
     dailyScans: Record<string, number>; // date -> scan count
     dailyErrors: Record<string, number>; // date -> error count
     consecutiveDaysAboveMeta: number;
+    totalDaysAboveMeta: number;
     lastScanTimestamps: number[]; // timestamps for anti-fraud
 }
 
@@ -116,6 +117,7 @@ export class GamificationService {
                         dailyScans: {},
                         dailyErrors: {},
                         consecutiveDaysAboveMeta: 0,
+                        totalDaysAboveMeta: 0,
                         lastScanTimestamps: [],
                     });
                 });
@@ -175,6 +177,7 @@ export class GamificationService {
                 dailyScans: {},
                 dailyErrors: {},
                 consecutiveDaysAboveMeta: 0,
+                totalDaysAboveMeta: 0,
                 lastScanTimestamps: [],
             });
         }
@@ -231,6 +234,7 @@ export class GamificationService {
         profile.xpMonthly = xp;
         profile.xpTotal = Math.max(profile.xpTotal, xp);
         profile.consecutiveDaysAboveMeta = consecutiveDays;
+        profile.totalDaysAboveMeta = diasAcimaMeta;
 
         let level = this.getLevel(xp);
         if (level.name === 'Desafiante' && !isTop1) {

commit acac26ff7b5edff4b039612dfe7c7acfe88bf145
Author: Fernando Souza <fernando10frango@gmail.com>
Date:   Sun Feb 22 01:06:58 2026 -0300

    feat: implement initial gamification service with user profiles, levels, achievements, and XP calculation.

diff --git a/services/gamificationService.ts b/services/gamificationService.ts
index 6b38083..278bd7f 100644
--- a/services/gamificationService.ts
+++ b/services/gamificationService.ts
@@ -224,7 +224,7 @@ export class GamificationService {
     ): Promise<GamificationProfile> {
         const profile = this.ensureProfile(userId, userName);
 
-        const spr = this.calculateSPR(totalScans, metaPercent, diasAcimaMeta, erros);
+        const spr = this.calculateSPR(monthlyTotalScans, metaPercent, diasAcimaMeta, erros);
         const xp = this.calculateXP(spr);
 
         profile.sprMonthly = spr;

commit bf4bb8c49ce7f0da1f07f90b5d3066e527a0d925
Author: Fernando Souza <fernando10frango@gmail.com>
Date:   Sat Feb 21 22:38:25 2026 -0300

    feat: implement InventoryView component for managing inventory, localizing items, and visualizing reconciliation progress.

diff --git a/services/gamificationService.ts b/services/gamificationService.ts
index 829b5c5..6b38083 100644
--- a/services/gamificationService.ts
+++ b/services/gamificationService.ts
@@ -1,5 +1,5 @@
-// Gamification Engine ÔÇö SPR, XP, Levels, Achievements, Anti-Fraud
 import { supabase } from './supabase';
+import { getSaoPauloIso } from '../utils/dateUtils';
 
 export interface GamificationLevel {
     name: string;
@@ -141,7 +141,7 @@ export class GamificationService {
             fraud_flag: profile.fraudFlag,
             fraud_alerts: profile.fraudAlerts,
             company_id: companyId,
-            updated_at: new Date().toISOString()
+            updated_at: getSaoPauloIso()
         };
 
         const { error } = await supabase
@@ -271,7 +271,7 @@ export class GamificationService {
             const badge = profile.badges.find(b => b.id === id);
             if (badge && !badge.unlocked) {
                 badge.unlocked = true;
-                badge.unlockedAt = new Date().toISOString();
+                badge.unlockedAt = getSaoPauloIso();
             }
         };
 
@@ -308,7 +308,7 @@ export class GamificationService {
             const last10 = timestamps.slice(-10);
             const span = (last10[last10.length - 1] - last10[0]) / 1000;
             if (span < 2) { // 2 seconds for 10 scans is inhumanly fast
-                profile.fraudAlerts.push(`${new Date().toISOString()} - Velocidade suspeita: ${(10 / span).toFixed(1)} scans/s`);
+                profile.fraudAlerts.push(`${getSaoPauloIso()} - Velocidade suspeita: ${(10 / span).toFixed(1)} scans/s`);
                 profile.fraudFlag = true;
                 await this.save(userId, userName, companyId);
                 return { suspicious: true, reason: 'Velocidade de scan suspeita detectada' };

commit 29a92bf6ce5fc7529d3e04610ff4f2dbf5c9d8f8
Author: Fernando Souza <fernando10frango@gmail.com>
Date:   Sat Feb 21 01:07:53 2026 -0300

    feat: Introduce WMS React context for comprehensive state management and integrate gamification services.

diff --git a/services/gamificationService.ts b/services/gamificationService.ts
index a8dd9f5..829b5c5 100644
--- a/services/gamificationService.ts
+++ b/services/gamificationService.ts
@@ -308,7 +308,7 @@ export class GamificationService {
             const last10 = timestamps.slice(-10);
             const span = (last10[last10.length - 1] - last10[0]) / 1000;
             if (span < 2) { // 2 seconds for 10 scans is inhumanly fast
-                profile.fraudAlerts.push(`${new Date().toLocaleString()} - Velocidade suspeita: ${(10 / span).toFixed(1)} scans/s`);
+                profile.fraudAlerts.push(`${new Date().toISOString()} - Velocidade suspeita: ${(10 / span).toFixed(1)} scans/s`);
                 profile.fraudFlag = true;
                 await this.save(userId, userName, companyId);
                 return { suspicious: true, reason: 'Velocidade de scan suspeita detectada' };

commit 7c09e0f48b367cfcda33327a7544ade5d26a7606
Author: Fernando Souza <fernando10frango@gmail.com>
Date:   Sat Feb 21 00:24:00 2026 -0300

    feat: Establish WMS context provider for centralized state management, gamification, and audio feedback.

diff --git a/services/gamificationService.ts b/services/gamificationService.ts
index da77c58..a8dd9f5 100644
--- a/services/gamificationService.ts
+++ b/services/gamificationService.ts
@@ -219,7 +219,8 @@ export class GamificationService {
         consecutiveDays: number,
         zeroErrorDays: number,
         avgMetaPercent: number,
-        extraMetrics?: any
+        extraMetrics?: any,
+        skipSave: boolean = false
     ): Promise<GamificationProfile> {
         const profile = this.ensureProfile(userId, userName);
 
@@ -251,7 +252,9 @@ export class GamificationService {
             profile.xpMonthly = Math.round(profile.xpMonthly * 0.8);
         }
 
-        await this.save(userId, userName, companyId);
+        if (!skipSave) {
+            await this.save(userId, userName, companyId);
+        }
         return profile;
     }
 

commit fce95e0bf873edec7c57f2ec79affbecb6be702c
Author: Fernando Souza <fernando10frango@gmail.com>
Date:   Fri Feb 20 23:37:42 2026 -0300

    feat: create WMS context for managing application state across inventory, inbound, outbound, users, drivers, and authentication.

diff --git a/services/gamificationService.ts b/services/gamificationService.ts
index be141f2..da77c58 100644
--- a/services/gamificationService.ts
+++ b/services/gamificationService.ts
@@ -198,6 +198,13 @@ export class GamificationService {
         return level;
     }
 
+    getNextLevel(xp: number): GamificationLevel | null {
+        for (const l of LEVELS) {
+            if (l.minXP > xp) return l;
+        }
+        return null;
+    }
+
     async recalculate(
         userId: string,
         userName: string,

commit fc0d7ec7712615650906860f9c33faab3de002d4
Author: Fernando Souza <fernando10frango@gmail.com>
Date:   Fri Feb 20 23:35:23 2026 -0300

    feat: introduce gamification service for user levels, achievements, and performance tracking

diff --git a/services/gamificationService.ts b/services/gamificationService.ts
index 2bc69cc..be141f2 100644
--- a/services/gamificationService.ts
+++ b/services/gamificationService.ts
@@ -1,7 +1,5 @@
 // Gamification Engine ÔÇö SPR, XP, Levels, Achievements, Anti-Fraud
-// import { supabase } from './supabase'; // Mocked but unused now
-
-// ... (keep types and constants as is) ...
+import { supabase } from './supabase';
 
 export interface GamificationLevel {
     name: string;
@@ -76,7 +74,6 @@ const DEFAULT_ACHIEVEMENTS: Achievement[] = [
     { id: 'zero_errors_30', title: 'Perfei├º├úo', description: '0 erros por 30 dias', icon: 'auto_awesome', unlocked: false },
     { id: 'top3_weekly', title: 'P├│dio Semanal', description: 'Top 3 no ranking do per├¡odo', icon: 'military_tech', unlocked: false },
     { id: 'avg_110', title: 'Supera├º├úo', description: '110% meta m├®dia no m├¬s', icon: 'speed', unlocked: false },
-    // Novas Conquistas
     { id: 'dr_inventario', title: 'Doutor Invent├írio', description: 'Participar de 12 invent├írios c├¡clicos', icon: 'fact_check', unlocked: false },
     { id: 'participacao_ativa', title: 'Participa├º├úo Ativa', description: 'Bipar pacotes 24 dias no m├¬s', icon: 'calendar_month', unlocked: false },
     { id: 'protetor_pacotes', title: 'Protetor de Pacotes', description: '50 tratativas no m├¬s', icon: 'verified_user', unlocked: false },
@@ -89,20 +86,6 @@ const DEFAULT_ACHIEVEMENTS: Achievement[] = [
     { id: 'incansavel', title: 'O Incans├ível', description: '30.000 scans no m├¬s', icon: 'battery_full', unlocked: false },
 ];
 
-const STORAGE_KEY = 'wms_gamification_profiles';
-
-// ========================
-// SERVICE
-// ========================
-
-export class GamificationService {
-    private profiles: Map<string, GamificationProfile> = new Map();
-    private initialized: boolean = false;
-
-import { supabase } from './supabase';
-
-// ... (keep types and constants as is) ...
-
 export class GamificationService {
     private profiles: Map<string, GamificationProfile> = new Map();
     private initialized: boolean = false;
@@ -126,10 +109,10 @@ export class GamificationService {
                         xpTotal: p.xp_total,
                         currentLevel: p.current_level,
                         sprMonthly: p.spr_monthly,
-                        badges: p.badges,
+                        badges: p.badges || DEFAULT_ACHIEVEMENTS.map(a => ({ ...a })),
                         fraudFlag: p.fraud_flag,
-                        fraudAlerts: p.fraud_alerts,
-                        performanceLogs: [], // Logs can be derived or kept local for now
+                        fraudAlerts: p.fraud_alerts || [],
+                        performanceLogs: [],
                         dailyScans: {},
                         dailyErrors: {},
                         consecutiveDaysAboveMeta: 0,
@@ -198,7 +181,22 @@ export class GamificationService {
         return this.profiles.get(userName)!;
     }
 
-    // ... (SPR and XP calculation formulas remain the same) ...
+    calculateSPR(totalScans: number, metaPercent: number, diasAcimaMeta: number, erros: number): number {
+        const raw = (totalScans * 0.5) + (metaPercent * 5) + (diasAcimaMeta * 20) - (erros * 30);
+        return Math.max(0, Math.round(raw));
+    }
+
+    calculateXP(spr: number): number {
+        return Math.round(spr * 1.2);
+    }
+
+    getLevel(xp: number): GamificationLevel {
+        let level = LEVELS[0];
+        for (const l of LEVELS) {
+            if (xp >= l.minXP) level = l;
+        }
+        return level;
+    }
 
     async recalculate(
         userId: string,
@@ -250,118 +248,80 @@ export class GamificationService {
         return profile;
     }
 
-    // ... (rest of the checkAchievements and anti-fraud methods) ...
-}
-
-    // ========================
-    // ACHIEVEMENTS
-    // ========================
     private async checkAchievements(
-    profile: GamificationProfile,
-    monthlyScans: number,
-    consecutiveDays: number,
-    zeroErrorDays: number,
-    isTop3Weekly: boolean,
-    avgMetaPercent: number,
-    extra ?: {
-        inventoryParticipations: number;
-        activeDays: number;
-        treatmentsDone: number;
-        localizedItems: number;
-        driverExpeditions: number;
-        mixedActivityDays: number;
-        incidentsLogged: number;
-        reversaPallets: number;
-    }
-): Promise < void> {
-    const unlock = async (id: string) => {
-        const badge = profile.badges.find(b => b.id === id);
-        if (badge && !badge.unlocked) {
-            badge.unlocked = true;
-            badge.unlockedAt = new Date().toISOString();
+        profile: GamificationProfile,
+        monthlyScans: number,
+        consecutiveDays: number,
+        zeroErrorDays: number,
+        isTop3Weekly: boolean,
+        avgMetaPercent: number,
+        extra?: any
+    ): Promise<void> {
+        const unlock = async (id: string) => {
+            const badge = profile.badges.find(b => b.id === id);
+            if (badge && !badge.unlocked) {
+                badge.unlocked = true;
+                badge.unlockedAt = new Date().toISOString();
+            }
+        };
+
+        if (consecutiveDays >= 10) await unlock('streak_10');
+        if (monthlyScans >= 1000) await unlock('scans_1000');
+        if (zeroErrorDays >= 30) await unlock('zero_errors_30');
+        if (isTop3Weekly) await unlock('top3_weekly');
+        if (avgMetaPercent >= 110) await unlock('avg_110');
+
+        if (extra) {
+            if (extra.inventoryParticipations >= 12) await unlock('dr_inventario');
+            if (extra.activeDays >= 24) await unlock('participacao_ativa');
+            if (extra.treatmentsDone >= 50) await unlock('protetor_pacotes');
+            if (extra.localizedItems >= 50) await unlock('investigador');
+            if (extra.driverExpeditions >= 120) await unlock('expedidor_mestre');
+            if (monthlyScans >= 10000) await unlock('scanner_lendario');
+            if (extra.mixedActivityDays >= 20) await unlock('proativo');
+            if (extra.incidentsLogged >= 100) await unlock('mestre_ps');
+            if (extra.reversaPallets >= 20) await unlock('mestre_reversa');
+            if (monthlyScans >= 30000) await unlock('incansavel');
         }
-    };
-
-    if(consecutiveDays >= 10) await unlock('streak_10');
-if (monthlyScans >= 1000) await unlock('scans_1000');
-if (zeroErrorDays >= 30) await unlock('zero_errors_30');
-if (isTop3Weekly) await unlock('top3_weekly');
-if (avgMetaPercent >= 110) await unlock('avg_110');
-
-// Novas Conquistas
-if (extra) {
-    if (extra.inventoryParticipations >= 12) await unlock('dr_inventario');
-    if (extra.activeDays >= 24) await unlock('participacao_ativa');
-    if (extra.treatmentsDone >= 50) await unlock('protetor_pacotes');
-    if (extra.localizedItems >= 50) await unlock('investigador');
-    if (extra.driverExpeditions >= 120) await unlock('expedidor_mestre');
-    if (monthlyScans >= 10000) await unlock('scanner_lendario');
-    if (extra.mixedActivityDays >= 20) await unlock('proativo');
-    if (extra.incidentsLogged >= 100) await unlock('mestre_ps');
-    if (extra.reversaPallets >= 20) await unlock('mestre_reversa');
-    if (monthlyScans >= 30000) await unlock('incansavel');
-}
     }
 
-    // ========================
-    // ANTI-FRAUD
-    // ========================
-    async registerScan(userId: string, userName: string): Promise < { suspicious: boolean; reason?: string } > {
-    const profile = this.ensureProfile(userId, userName);
-    const now = Date.now();
-
-    profile.lastScanTimestamps.push(now);
-    if(profile.lastScanTimestamps.length > 20) profile.lastScanTimestamps = profile.lastScanTimestamps.slice(-20);
-
-    const timestamps = profile.lastScanTimestamps;
-
-    if(timestamps.length >= 10) {
-    const last10 = timestamps.slice(-10);
-    const span = (last10[last10.length - 1] - last10[0]) / 1000;
-    if (span < 20) {
-        profile.fraudAlerts.push(`${new Date().toLocaleString()} - Velocidade suspeita: ${(10 / span).toFixed(1)} scans/s`);
-        profile.fraudFlag = true;
-        await this.save(userId);
-        return { suspicious: true, reason: 'Velocidade de scan suspeita detectada' };
-    }
-}
+    async registerScan(userId: string, userName: string, companyId: string): Promise<{ suspicious: boolean; reason?: string }> {
+        const profile = this.ensureProfile(userId, userName);
+        const now = Date.now();
 
-if (timestamps.length >= 6) {
-    const last6 = timestamps.slice(-6);
-    const intervals = [];
-    for (let i = 1; i < last6.length; i++) intervals.push(last6[i] - last6[i - 1]);
-    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
-    const allSimilar = intervals.every(iv => Math.abs(iv - avgInterval) < 100);
-    if (allSimilar && avgInterval < 3000) {
-        profile.fraudAlerts.push(`${new Date().toLocaleString()} - Padr├úo repetitivo: intervalo constante de ${Math.round(avgInterval)}ms`);
-        profile.fraudFlag = true;
-        await this.save(userId);
-        return { suspicious: true, reason: 'Padr├úo repetitivo de scan detectado' };
-    }
-}
+        profile.lastScanTimestamps.push(now);
+        if (profile.lastScanTimestamps.length > 20) profile.lastScanTimestamps = profile.lastScanTimestamps.slice(-20);
+
+        const timestamps = profile.lastScanTimestamps;
+
+        if (timestamps.length >= 10) {
+            const last10 = timestamps.slice(-10);
+            const span = (last10[last10.length - 1] - last10[0]) / 1000;
+            if (span < 2) { // 2 seconds for 10 scans is inhumanly fast
+                profile.fraudAlerts.push(`${new Date().toLocaleString()} - Velocidade suspeita: ${(10 / span).toFixed(1)} scans/s`);
+                profile.fraudFlag = true;
+                await this.save(userId, userName, companyId);
+                return { suspicious: true, reason: 'Velocidade de scan suspeita detectada' };
+            }
+        }
 
-await this.save(userId);
-return { suspicious: false };
+        await this.save(userId, userName, companyId);
+        return { suspicious: false };
     }
 
-    async clearFraudFlag(userId: string): Promise < void> {
-    const profile = this.profiles.get(userId);
-    if(profile) {
-        profile.fraudFlag = false;
-        await this.save(userId);
+    async clearFraudFlag(userId: string, userName: string, companyId: string): Promise<void> {
+        const profile = this.profiles.get(userName);
+        if (profile) {
+            profile.fraudFlag = false;
+            await this.save(userId, userName, companyId);
+        }
     }
-}
 
-    // ========================
-    // RANKING
-    // ========================
-    async getMonthlyRanking(): Promise < GamificationProfile[] > {
-    if(!this.initialized) await this.init();
-    return Array.from(this.profiles.values())
-        .filter(p => p.sprMonthly > 0)
-        .sort((a, b) => b.sprMonthly - a.sprMonthly);
-}
+    async getMonthlyRanking(): Promise<GamificationProfile[]> {
+        return Array.from(this.profiles.values())
+            .filter(p => p.sprMonthly > 0)
+            .sort((a, b) => b.sprMonthly - a.sprMonthly);
+    }
 }
 
-// Singleton
 export const gamificationService = new GamificationService();

commit 6c2150a01b6cefd3a2a94303648e97008b355b3a
Author: Fernando Souza <fernando10frango@gmail.com>
Date:   Fri Feb 20 23:34:55 2026 -0300

    feat: Add gamification service to manage user profiles, calculate XP/SPR, track levels and achievements, and detect fraud.

diff --git a/services/gamificationService.ts b/services/gamificationService.ts
index 77dea01..2bc69cc 100644
--- a/services/gamificationService.ts
+++ b/services/gamificationService.ts
@@ -99,14 +99,42 @@ export class GamificationService {
     private profiles: Map<string, GamificationProfile> = new Map();
     private initialized: boolean = false;
 
-    async init(): Promise<void> {
-        if (this.initialized) return;
+import { supabase } from './supabase';
+
+// ... (keep types and constants as is) ...
+
+export class GamificationService {
+    private profiles: Map<string, GamificationProfile> = new Map();
+    private initialized: boolean = false;
+
+    async init(companyId: string): Promise<void> {
         try {
-            const data = localStorage.getItem(STORAGE_KEY);
+            const { data, error } = await supabase
+                .from('gamification_profiles')
+                .select('*')
+                .eq('company_id', companyId);
+
+            if (error) throw error;
+
             if (data) {
-                const parsed = JSON.parse(data);
-                Object.entries(parsed).forEach(([userId, profile]) => {
-                    this.profiles.set(userId, profile as GamificationProfile);
+                this.profiles.clear();
+                data.forEach((p: any) => {
+                    this.profiles.set(p.user_name, {
+                        userId: p.user_id,
+                        userName: p.user_name,
+                        xpMonthly: p.xp_monthly,
+                        xpTotal: p.xp_total,
+                        currentLevel: p.current_level,
+                        sprMonthly: p.spr_monthly,
+                        badges: p.badges,
+                        fraudFlag: p.fraud_flag,
+                        fraudAlerts: p.fraud_alerts,
+                        performanceLogs: [], // Logs can be derived or kept local for now
+                        dailyScans: {},
+                        dailyErrors: {},
+                        consecutiveDaysAboveMeta: 0,
+                        lastScanTimestamps: [],
+                    });
                 });
             }
             this.initialized = true;
@@ -115,29 +143,42 @@ export class GamificationService {
         }
     }
 
-    private async save(userId: string): Promise<void> {
-        const profile = this.profiles.get(userId);
+    private async save(userId: string, userName: string, companyId: string): Promise<void> {
+        const profile = this.profiles.get(userName);
         if (!profile) return;
 
-        const data = localStorage.getItem(STORAGE_KEY);
-        const allProfiles = data ? JSON.parse(data) : {};
-        allProfiles[userId] = profile;
-        localStorage.setItem(STORAGE_KEY, JSON.stringify(allProfiles));
+        const dbProfile = {
+            user_id: userId,
+            user_name: userName,
+            xp_monthly: profile.xpMonthly,
+            xp_total: profile.xpTotal,
+            current_level: profile.currentLevel,
+            spr_monthly: profile.sprMonthly,
+            badges: profile.badges,
+            fraud_flag: profile.fraudFlag,
+            fraud_alerts: profile.fraudAlerts,
+            company_id: companyId,
+            updated_at: new Date().toISOString()
+        };
+
+        const { error } = await supabase
+            .from('gamification_profiles')
+            .upsert(dbProfile);
+
+        if (error) console.error("Gamification save failed", error);
     }
 
-    async getProfile(userId: string): Promise<GamificationProfile | undefined> {
-        if (!this.initialized) await this.init();
-        return this.profiles.get(userId);
+    async getProfile(userName: string): Promise<GamificationProfile | undefined> {
+        return this.profiles.get(userName);
     }
 
     async getAllProfiles(): Promise<GamificationProfile[]> {
-        if (!this.initialized) await this.init();
         return Array.from(this.profiles.values());
     }
 
     private ensureProfile(userId: string, userName: string): GamificationProfile {
-        if (!this.profiles.has(userId)) {
-            this.profiles.set(userId, {
+        if (!this.profiles.has(userName)) {
+            this.profiles.set(userName, {
                 userId,
                 userName,
                 xpMonthly: 0,
@@ -154,50 +195,15 @@ export class GamificationService {
                 lastScanTimestamps: [],
             });
         }
-        const p = this.profiles.get(userId)!;
-        if (userName && p.userName !== userName) p.userName = userName;
-        return p;
+        return this.profiles.get(userName)!;
     }
 
-    // ========================
-    // SPR CALCULATION
-    // ========================
-    calculateSPR(totalScans: number, metaPercent: number, diasAcimaMeta: number, erros: number): number {
-        const raw = (totalScans * 0.5) + (metaPercent * 5) + (diasAcimaMeta * 20) - (erros * 30);
-        return Math.max(0, Math.round(raw));
-    }
+    // ... (SPR and XP calculation formulas remain the same) ...
 
-    // ========================
-    // XP CALCULATION
-    // ========================
-    calculateXP(spr: number): number {
-        return Math.round(spr * 1.2);
-    }
-
-    // ========================
-    // LEVEL DETERMINATION
-    // ========================
-    getLevel(xp: number): GamificationLevel {
-        let level = LEVELS[0];
-        for (const l of LEVELS) {
-            if (xp >= l.minXP) level = l;
-        }
-        return level;
-    }
-
-    getNextLevel(xp: number): GamificationLevel | null {
-        for (const l of LEVELS) {
-            if (l.minXP > xp) return l;
-        }
-        return null;
-    }
-
-    // ========================
-    // FULL RECALCULATION
-    // ========================
     async recalculate(
         userId: string,
         userName: string,
+        companyId: string,
         totalScans: number,
         metaPercent: number,
         diasAcimaMeta: number,
@@ -208,26 +214,10 @@ export class GamificationService {
         consecutiveDays: number,
         zeroErrorDays: number,
         avgMetaPercent: number,
-        extraMetrics?: {
-            inventoryParticipations: number;
-            activeDays: number;
-            treatmentsDone: number;
-            localizedItems: number;
-            driverExpeditions: number;
-            mixedActivityDays: number;
-            incidentsLogged: number;
-            reversaPallets: number;
-        }
+        extraMetrics?: any
     ): Promise<GamificationProfile> {
         const profile = this.ensureProfile(userId, userName);
 
-        const currentMonth = new Date().toISOString().slice(0, 7);
-        const lastLog = profile.performanceLogs[profile.performanceLogs.length - 1];
-        if (lastLog && lastLog.mesReferencia !== currentMonth) {
-            profile.xpMonthly = 0;
-            profile.sprMonthly = 0;
-        }
-
         const spr = this.calculateSPR(totalScans, metaPercent, diasAcimaMeta, erros);
         const xp = this.calculateXP(spr);
 
@@ -256,129 +246,121 @@ export class GamificationService {
             profile.xpMonthly = Math.round(profile.xpMonthly * 0.8);
         }
 
-        const logEntry: PerformanceLog = {
-            userId, userName, totalScans, metaPercent, diasAcimaMeta, erros, spr, xp: profile.xpMonthly, mesReferencia: currentMonth
-        };
-
-        const existingIdx = profile.performanceLogs.findIndex(l => l.mesReferencia === currentMonth);
-        if (existingIdx >= 0) {
-            profile.performanceLogs[existingIdx] = logEntry;
-        } else {
-            profile.performanceLogs.push(logEntry);
-        }
-
-        await this.save(userId);
+        await this.save(userId, userName, companyId);
         return profile;
     }
 
+    // ... (rest of the checkAchievements and anti-fraud methods) ...
+}
+
     // ========================
     // ACHIEVEMENTS
     // ========================
     private async checkAchievements(
-        profile: GamificationProfile,
-        monthlyScans: number,
-        consecutiveDays: number,
-        zeroErrorDays: number,
-        isTop3Weekly: boolean,
-        avgMetaPercent: number,
-        extra?: {
-            inventoryParticipations: number;
-            activeDays: number;
-            treatmentsDone: number;
-            localizedItems: number;
-            driverExpeditions: number;
-            mixedActivityDays: number;
-            incidentsLogged: number;
-            reversaPallets: number;
-        }
-    ): Promise<void> {
-        const unlock = async (id: string) => {
-            const badge = profile.badges.find(b => b.id === id);
-            if (badge && !badge.unlocked) {
-                badge.unlocked = true;
-                badge.unlockedAt = new Date().toISOString();
-            }
-        };
-
-        if (consecutiveDays >= 10) await unlock('streak_10');
-        if (monthlyScans >= 1000) await unlock('scans_1000');
-        if (zeroErrorDays >= 30) await unlock('zero_errors_30');
-        if (isTop3Weekly) await unlock('top3_weekly');
-        if (avgMetaPercent >= 110) await unlock('avg_110');
-
-        // Novas Conquistas
-        if (extra) {
-            if (extra.inventoryParticipations >= 12) await unlock('dr_inventario');
-            if (extra.activeDays >= 24) await unlock('participacao_ativa');
-            if (extra.treatmentsDone >= 50) await unlock('protetor_pacotes');
-            if (extra.localizedItems >= 50) await unlock('investigador');
-            if (extra.driverExpeditions >= 120) await unlock('expedidor_mestre');
-            if (monthlyScans >= 10000) await unlock('scanner_lendario');
-            if (extra.mixedActivityDays >= 20) await unlock('proativo');
-            if (extra.incidentsLogged >= 100) await unlock('mestre_ps');
-            if (extra.reversaPallets >= 20) await unlock('mestre_reversa');
-            if (monthlyScans >= 30000) await unlock('incansavel');
+    profile: GamificationProfile,
+    monthlyScans: number,
+    consecutiveDays: number,
+    zeroErrorDays: number,
+    isTop3Weekly: boolean,
+    avgMetaPercent: number,
+    extra ?: {
+        inventoryParticipations: number;
+        activeDays: number;
+        treatmentsDone: number;
+        localizedItems: number;
+        driverExpeditions: number;
+        mixedActivityDays: number;
+        incidentsLogged: number;
+        reversaPallets: number;
+    }
+): Promise < void> {
+    const unlock = async (id: string) => {
+        const badge = profile.badges.find(b => b.id === id);
+        if (badge && !badge.unlocked) {
+            badge.unlocked = true;
+            badge.unlockedAt = new Date().toISOString();
         }
+    };
+
+    if(consecutiveDays >= 10) await unlock('streak_10');
+if (monthlyScans >= 1000) await unlock('scans_1000');
+if (zeroErrorDays >= 30) await unlock('zero_errors_30');
+if (isTop3Weekly) await unlock('top3_weekly');
+if (avgMetaPercent >= 110) await unlock('avg_110');
+
+// Novas Conquistas
+if (extra) {
+    if (extra.inventoryParticipations >= 12) await unlock('dr_inventario');
+    if (extra.activeDays >= 24) await unlock('participacao_ativa');
+    if (extra.treatmentsDone >= 50) await unlock('protetor_pacotes');
+    if (extra.localizedItems >= 50) await unlock('investigador');
+    if (extra.driverExpeditions >= 120) await unlock('expedidor_mestre');
+    if (monthlyScans >= 10000) await unlock('scanner_lendario');
+    if (extra.mixedActivityDays >= 20) await unlock('proativo');
+    if (extra.incidentsLogged >= 100) await unlock('mestre_ps');
+    if (extra.reversaPallets >= 20) await unlock('mestre_reversa');
+    if (monthlyScans >= 30000) await unlock('incansavel');
+}
     }
 
     // ========================
     // ANTI-FRAUD
     // ========================
-    async registerScan(userId: string, userName: string): Promise<{ suspicious: boolean; reason?: string }> {
-        const profile = this.ensureProfile(userId, userName);
-        const now = Date.now();
+    async registerScan(userId: string, userName: string): Promise < { suspicious: boolean; reason?: string } > {
+    const profile = this.ensureProfile(userId, userName);
+    const now = Date.now();
 
-        profile.lastScanTimestamps.push(now);
-        if (profile.lastScanTimestamps.length > 20) profile.lastScanTimestamps = profile.lastScanTimestamps.slice(-20);
+    profile.lastScanTimestamps.push(now);
+    if(profile.lastScanTimestamps.length > 20) profile.lastScanTimestamps = profile.lastScanTimestamps.slice(-20);
 
-        const timestamps = profile.lastScanTimestamps;
+    const timestamps = profile.lastScanTimestamps;
 
-        if (timestamps.length >= 10) {
-            const last10 = timestamps.slice(-10);
-            const span = (last10[last10.length - 1] - last10[0]) / 1000;
-            if (span < 20) {
-                profile.fraudAlerts.push(`${new Date().toLocaleString()} - Velocidade suspeita: ${(10 / span).toFixed(1)} scans/s`);
-                profile.fraudFlag = true;
-                await this.save(userId);
-                return { suspicious: true, reason: 'Velocidade de scan suspeita detectada' };
-            }
-        }
-
-        if (timestamps.length >= 6) {
-            const last6 = timestamps.slice(-6);
-            const intervals = [];
-            for (let i = 1; i < last6.length; i++) intervals.push(last6[i] - last6[i - 1]);
-            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
-            const allSimilar = intervals.every(iv => Math.abs(iv - avgInterval) < 100);
-            if (allSimilar && avgInterval < 3000) {
-                profile.fraudAlerts.push(`${new Date().toLocaleString()} - Padr├úo repetitivo: intervalo constante de ${Math.round(avgInterval)}ms`);
-                profile.fraudFlag = true;
-                await this.save(userId);
-                return { suspicious: true, reason: 'Padr├úo repetitivo de scan detectado' };
-            }
-        }
+    if(timestamps.length >= 10) {
+    const last10 = timestamps.slice(-10);
+    const span = (last10[last10.length - 1] - last10[0]) / 1000;
+    if (span < 20) {
+        profile.fraudAlerts.push(`${new Date().toLocaleString()} - Velocidade suspeita: ${(10 / span).toFixed(1)} scans/s`);
+        profile.fraudFlag = true;
+        await this.save(userId);
+        return { suspicious: true, reason: 'Velocidade de scan suspeita detectada' };
+    }
+}
 
+if (timestamps.length >= 6) {
+    const last6 = timestamps.slice(-6);
+    const intervals = [];
+    for (let i = 1; i < last6.length; i++) intervals.push(last6[i] - last6[i - 1]);
+    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
+    const allSimilar = intervals.every(iv => Math.abs(iv - avgInterval) < 100);
+    if (allSimilar && avgInterval < 3000) {
+        profile.fraudAlerts.push(`${new Date().toLocaleString()} - Padr├úo repetitivo: intervalo constante de ${Math.round(avgInterval)}ms`);
+        profile.fraudFlag = true;
         await this.save(userId);
-        return { suspicious: false };
+        return { suspicious: true, reason: 'Padr├úo repetitivo de scan detectado' };
     }
+}
 
-    async clearFraudFlag(userId: string): Promise<void> {
-        const profile = this.profiles.get(userId);
-        if (profile) {
-            profile.fraudFlag = false;
-            await this.save(userId);
-        }
+await this.save(userId);
+return { suspicious: false };
+    }
+
+    async clearFraudFlag(userId: string): Promise < void> {
+    const profile = this.profiles.get(userId);
+    if(profile) {
+        profile.fraudFlag = false;
+        await this.save(userId);
     }
+}
 
     // ========================
     // RANKING
     // ========================
-    async getMonthlyRanking(): Promise<GamificationProfile[]> {
-        if (!this.initialized) await this.init();
-        return Array.from(this.profiles.values())
-            .filter(p => p.sprMonthly > 0)
-            .sort((a, b) => b.sprMonthly - a.sprMonthly);
-    }
+    async getMonthlyRanking(): Promise < GamificationProfile[] > {
+    if(!this.initialized) await this.init();
+    return Array.from(this.profiles.values())
+        .filter(p => p.sprMonthly > 0)
+        .sort((a, b) => b.sprMonthly - a.sprMonthly);
+}
 }
 
 // Singleton

commit ffff8845ae22551b8b419fed9d3cb1e2bc7b317a
Author: Fernando Souza <fernando10frango@gmail.com>
Date:   Fri Feb 20 18:45:54 2026 -0300

    feat: Implement a gamification engine including XP, levels, achievements, SPR calculation, and anti-fraud mechanisms.

diff --git a/services/gamificationService.ts b/services/gamificationService.ts
index 347be9c..77dea01 100644
--- a/services/gamificationService.ts
+++ b/services/gamificationService.ts
@@ -76,6 +76,17 @@ const DEFAULT_ACHIEVEMENTS: Achievement[] = [
     { id: 'zero_errors_30', title: 'Perfei├º├úo', description: '0 erros por 30 dias', icon: 'auto_awesome', unlocked: false },
     { id: 'top3_weekly', title: 'P├│dio Semanal', description: 'Top 3 no ranking do per├¡odo', icon: 'military_tech', unlocked: false },
     { id: 'avg_110', title: 'Supera├º├úo', description: '110% meta m├®dia no m├¬s', icon: 'speed', unlocked: false },
+    // Novas Conquistas
+    { id: 'dr_inventario', title: 'Doutor Invent├írio', description: 'Participar de 12 invent├írios c├¡clicos', icon: 'fact_check', unlocked: false },
+    { id: 'participacao_ativa', title: 'Participa├º├úo Ativa', description: 'Bipar pacotes 24 dias no m├¬s', icon: 'calendar_month', unlocked: false },
+    { id: 'protetor_pacotes', title: 'Protetor de Pacotes', description: '50 tratativas no m├¬s', icon: 'verified_user', unlocked: false },
+    { id: 'investigador', title: 'O Investigador', description: 'Achar 50 poss├¡veis perdas no m├¬s', icon: 'manage_search', unlocked: false },
+    { id: 'expedidor_mestre', title: 'Expedidor Mestre', description: 'Expedir 120 motoristas no m├¬s', icon: 'local_shipping', unlocked: false },
+    { id: 'scanner_lendario', title: 'Scanner Lend├írio', description: '10.000 scans no m├¬s', icon: 'stars', unlocked: false },
+    { id: 'proativo', title: 'O Proativo', description: '20 dias com Entrada+Sa├¡da+Invent├írio', icon: 'bolt', unlocked: false },
+    { id: 'mestre_ps', title: 'Mestre do PS', description: '100 incidentes registrados no m├¬s', icon: 'assignment_late', unlocked: false },
+    { id: 'mestre_reversa', title: 'Mestre da Reversa', description: 'Expedir 20 pallets de reversa no m├¬s', icon: 'sync_alt', unlocked: false },
+    { id: 'incansavel', title: 'O Incans├ível', description: '30.000 scans no m├¬s', icon: 'battery_full', unlocked: false },
 ];
 
 const STORAGE_KEY = 'wms_gamification_profiles';
@@ -197,6 +208,16 @@ export class GamificationService {
         consecutiveDays: number,
         zeroErrorDays: number,
         avgMetaPercent: number,
+        extraMetrics?: {
+            inventoryParticipations: number;
+            activeDays: number;
+            treatmentsDone: number;
+            localizedItems: number;
+            driverExpeditions: number;
+            mixedActivityDays: number;
+            incidentsLogged: number;
+            reversaPallets: number;
+        }
     ): Promise<GamificationProfile> {
         const profile = this.ensureProfile(userId, userName);
 
@@ -221,7 +242,15 @@ export class GamificationService {
         }
         profile.currentLevel = level.name;
 
-        await this.checkAchievements(profile, monthlyTotalScans, consecutiveDays, zeroErrorDays, isTop3Weekly, avgMetaPercent);
+        await this.checkAchievements(
+            profile,
+            monthlyTotalScans,
+            consecutiveDays,
+            zeroErrorDays,
+            isTop3Weekly,
+            avgMetaPercent,
+            extraMetrics
+        );
 
         if (profile.fraudFlag) {
             profile.xpMonthly = Math.round(profile.xpMonthly * 0.8);
@@ -252,13 +281,22 @@ export class GamificationService {
         zeroErrorDays: number,
         isTop3Weekly: boolean,
         avgMetaPercent: number,
+        extra?: {
+            inventoryParticipations: number;
+            activeDays: number;
+            treatmentsDone: number;
+            localizedItems: number;
+            driverExpeditions: number;
+            mixedActivityDays: number;
+            incidentsLogged: number;
+            reversaPallets: number;
+        }
     ): Promise<void> {
         const unlock = async (id: string) => {
             const badge = profile.badges.find(b => b.id === id);
             if (badge && !badge.unlocked) {
                 badge.unlocked = true;
                 badge.unlockedAt = new Date().toISOString();
-                // Persist achievements within profile save
             }
         };
 
@@ -267,6 +305,20 @@ export class GamificationService {
         if (zeroErrorDays >= 30) await unlock('zero_errors_30');
         if (isTop3Weekly) await unlock('top3_weekly');
         if (avgMetaPercent >= 110) await unlock('avg_110');
+
+        // Novas Conquistas
+        if (extra) {
+            if (extra.inventoryParticipations >= 12) await unlock('dr_inventario');
+            if (extra.activeDays >= 24) await unlock('participacao_ativa');
+            if (extra.treatmentsDone >= 50) await unlock('protetor_pacotes');
+            if (extra.localizedItems >= 50) await unlock('investigador');
+            if (extra.driverExpeditions >= 120) await unlock('expedidor_mestre');
+            if (monthlyScans >= 10000) await unlock('scanner_lendario');
+            if (extra.mixedActivityDays >= 20) await unlock('proativo');
+            if (extra.incidentsLogged >= 100) await unlock('mestre_ps');
+            if (extra.reversaPallets >= 20) await unlock('mestre_reversa');
+            if (monthlyScans >= 30000) await unlock('incansavel');
+        }
     }
 
     // ========================

commit acfa4d4364b622ce124d6d861c40690c1332222c
Author: Fernando Souza <fernando10frango@gmail.com>
Date:   Thu Feb 19 23:44:02 2026 -0300

    feat: implement gamification service with SPR, XP, levels, achievements, and anti-fraud features.

diff --git a/services/gamificationService.ts b/services/gamificationService.ts
index 1bb1035..347be9c 100644
--- a/services/gamificationService.ts
+++ b/services/gamificationService.ts
@@ -1,9 +1,7 @@
 // Gamification Engine ÔÇö SPR, XP, Levels, Achievements, Anti-Fraud
-import { supabase } from './supabase';
+// import { supabase } from './supabase'; // Mocked but unused now
 
-// ========================
-// TYPES
-// ========================
+// ... (keep types and constants as is) ...
 
 export interface GamificationLevel {
     name: string;
@@ -93,38 +91,12 @@ export class GamificationService {
     async init(): Promise<void> {
         if (this.initialized) return;
         try {
-            // 1. Fetch Profiles
-            const { data: profileData } = await supabase.from('gamification_profiles').select('*');
-            // 2. Fetch Achievements
-            const { data: achievementData } = await supabase.from('gamification_achievements').select('*');
-
-            if (profileData) {
-                for (const p of profileData) {
-                    const profileAchievements = (achievementData || [])
-                        .filter(a => a.user_id === p.user_id)
-                        .map(a => a.id);
-
-                    this.profiles.set(p.user_id, {
-                        userId: p.user_id,
-                        userName: '', // We'll fill this from auth/users later or link join
-                        xpMonthly: p.xp_monthly,
-                        xpTotal: p.xp_total,
-                        currentLevel: p.current_level,
-                        sprMonthly: p.spr_monthly,
-                        fraudFlag: p.fraud_flag,
-                        fraudAlerts: p.fraud_alerts as string[],
-                        badges: DEFAULT_ACHIEVEMENTS.map(a => ({
-                            ...a,
-                            unlocked: profileAchievements.includes(a.id),
-                            unlockedAt: achievementData?.find(ad => ad.user_id === p.user_id && ad.id === a.id)?.unlocked_at
-                        })),
-                        performanceLogs: [], // Log history can be complex, skipping for now as not critical for current view
-                        dailyScans: {},
-                        dailyErrors: {},
-                        consecutiveDaysAboveMeta: 0,
-                        lastScanTimestamps: [],
-                    });
-                }
+            const data = localStorage.getItem(STORAGE_KEY);
+            if (data) {
+                const parsed = JSON.parse(data);
+                Object.entries(parsed).forEach(([userId, profile]) => {
+                    this.profiles.set(userId, profile as GamificationProfile);
+                });
             }
             this.initialized = true;
         } catch (e) {
@@ -136,16 +108,10 @@ export class GamificationService {
         const profile = this.profiles.get(userId);
         if (!profile) return;
 
-        await supabase.from('gamification_profiles').upsert({
-            user_id: userId,
-            xp_monthly: profile.xpMonthly,
-            xp_total: profile.xpTotal,
-            current_level: profile.currentLevel,
-            spr_monthly: profile.sprMonthly,
-            fraud_flag: profile.fraudFlag,
-            fraud_alerts: profile.fraudAlerts,
-            updated_at: new Date().toISOString()
-        });
+        const data = localStorage.getItem(STORAGE_KEY);
+        const allProfiles = data ? JSON.parse(data) : {};
+        allProfiles[userId] = profile;
+        localStorage.setItem(STORAGE_KEY, JSON.stringify(allProfiles));
     }
 
     async getProfile(userId: string): Promise<GamificationProfile | undefined> {
@@ -234,7 +200,6 @@ export class GamificationService {
     ): Promise<GamificationProfile> {
         const profile = this.ensureProfile(userId, userName);
 
-        // Check monthly reset
         const currentMonth = new Date().toISOString().slice(0, 7);
         const lastLog = profile.performanceLogs[profile.performanceLogs.length - 1];
         if (lastLog && lastLog.mesReferencia !== currentMonth) {
@@ -242,31 +207,26 @@ export class GamificationService {
             profile.sprMonthly = 0;
         }
 
-        // Calculate SPR & XP
         const spr = this.calculateSPR(totalScans, metaPercent, diasAcimaMeta, erros);
         const xp = this.calculateXP(spr);
 
         profile.sprMonthly = spr;
         profile.xpMonthly = xp;
-        profile.xpTotal = Math.max(profile.xpTotal, xp); // Record best highscore as total or cumulative? For now let's use highscore
+        profile.xpTotal = Math.max(profile.xpTotal, xp);
         profile.consecutiveDaysAboveMeta = consecutiveDays;
 
-        // Determine level
         let level = this.getLevel(xp);
         if (level.name === 'Desafiante' && !isTop1) {
             level = LEVELS[8]; // Gr├úo-Mestre
         }
         profile.currentLevel = level.name;
 
-        // Check achievements
         await this.checkAchievements(profile, monthlyTotalScans, consecutiveDays, zeroErrorDays, isTop3Weekly, avgMetaPercent);
 
-        // Apply fraud penalty
         if (profile.fraudFlag) {
             profile.xpMonthly = Math.round(profile.xpMonthly * 0.8);
         }
 
-        // Update log
         const logEntry: PerformanceLog = {
             userId, userName, totalScans, metaPercent, diasAcimaMeta, erros, spr, xp: profile.xpMonthly, mesReferencia: currentMonth
         };
@@ -298,12 +258,7 @@ export class GamificationService {
             if (badge && !badge.unlocked) {
                 badge.unlocked = true;
                 badge.unlockedAt = new Date().toISOString();
-
-                await supabase.from('gamification_achievements').insert({
-                    id,
-                    user_id: profile.userId,
-                    unlocked_at: badge.unlockedAt
-                });
+                // Persist achievements within profile save
             }
         };
 
@@ -326,7 +281,6 @@ export class GamificationService {
 
         const timestamps = profile.lastScanTimestamps;
 
-        // Check 1: Speed
         if (timestamps.length >= 10) {
             const last10 = timestamps.slice(-10);
             const span = (last10[last10.length - 1] - last10[0]) / 1000;
@@ -338,7 +292,6 @@ export class GamificationService {
             }
         }
 
-        // Check 2: Robot pattern
         if (timestamps.length >= 6) {
             const last6 = timestamps.slice(-6);
             const intervals = [];

commit 535f9e44151410f3c7e3f6c1d836fa959375791b
Author: Fernando Souza <fernando10frango@gmail.com>
Date:   Thu Feb 19 02:59:22 2026 -0300

    Primeiro commit

diff --git a/services/gamificationService.ts b/services/gamificationService.ts
new file mode 100644
index 0000000..1bb1035
--- /dev/null
+++ b/services/gamificationService.ts
@@ -0,0 +1,380 @@
+// Gamification Engine ÔÇö SPR, XP, Levels, Achievements, Anti-Fraud
+import { supabase } from './supabase';
+
+// ========================
+// TYPES
+// ========================
+
+export interface GamificationLevel {
+    name: string;
+    minXP: number;
+    color: string;       // Tailwind text color
+    bgColor: string;     // Tailwind bg color
+    borderColor: string; // Tailwind border color
+    icon: string;        // emoji
+}
+
+export interface Achievement {
+    id: string;
+    title: string;
+    description: string;
+    icon: string;
+    unlocked: boolean;
+    unlockedAt?: string;
+}
+
+export interface PerformanceLog {
+    userId: string;
+    userName: string;
+    totalScans: number;
+    metaPercent: number;
+    diasAcimaMeta: number;
+    erros: number;
+    spr: number;
+    xp: number;
+    mesReferencia: string; // YYYY-MM
+}
+
+export interface GamificationProfile {
+    userId: string;
+    userName: string;
+    xpMonthly: number;
+    xpTotal: number;
+    currentLevel: string;
+    sprMonthly: number;
+    badges: Achievement[];
+    fraudFlag: boolean;
+    fraudAlerts: string[];
+    performanceLogs: PerformanceLog[];
+    // Daily tracking
+    dailyScans: Record<string, number>; // date -> scan count
+    dailyErrors: Record<string, number>; // date -> error count
+    consecutiveDaysAboveMeta: number;
+    lastScanTimestamps: number[]; // timestamps for anti-fraud
+}
+
+// ========================
+// CONSTANTS
+// ========================
+
+export const DAILY_GOAL = 350;
+
+export const LEVELS: GamificationLevel[] = [
+    { name: 'Ferro', minXP: 0, color: 'text-slate-400', bgColor: 'bg-slate-700', borderColor: 'border-slate-500', icon: 'diamond' },
+    { name: 'Bronze', minXP: 1000, color: 'text-amber-700', bgColor: 'bg-amber-900/30', borderColor: 'border-amber-700', icon: 'workspace_premium' },
+    { name: 'Prata', minXP: 2500, color: 'text-slate-300', bgColor: 'bg-slate-400/20', borderColor: 'border-slate-300', icon: 'workspace_premium' },
+    { name: 'Ouro', minXP: 5000, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-400', icon: 'workspace_premium' },
+    { name: 'Platina', minXP: 8000, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', borderColor: 'border-cyan-400', icon: 'auto_awesome' },
+    { name: 'Esmeralda', minXP: 12000, color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', borderColor: 'border-emerald-400', icon: 'verified' },
+    { name: 'Diamante', minXP: 18000, color: 'text-blue-400', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-400', icon: 'diamond' },
+    { name: 'Mestre', minXP: 25000, color: 'text-purple-400', bgColor: 'bg-purple-500/20', borderColor: 'border-purple-400', icon: 'stars' },
+    { name: 'Gr├úo-Mestre', minXP: 35000, color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-400', icon: 'local_fire_department' },
+    { name: 'Desafiante', minXP: 45000, color: 'text-yellow-300', bgColor: 'bg-gradient-to-r from-black to-yellow-900/40', borderColor: 'border-yellow-400', icon: 'military_tech' },
+];
+
+const DEFAULT_ACHIEVEMENTS: Achievement[] = [
+    { id: 'streak_10', title: 'Consist├¬ncia de Ferro', description: '10 dias consecutivos acima da meta', icon: 'whatshot', unlocked: false },
+    { id: 'scans_1000', title: 'Scanner Mestre', description: '1.000 scans no m├¬s', icon: 'inventory_2', unlocked: false },
+    { id: 'zero_errors_30', title: 'Perfei├º├úo', description: '0 erros por 30 dias', icon: 'auto_awesome', unlocked: false },
+    { id: 'top3_weekly', title: 'P├│dio Semanal', description: 'Top 3 no ranking do per├¡odo', icon: 'military_tech', unlocked: false },
+    { id: 'avg_110', title: 'Supera├º├úo', description: '110% meta m├®dia no m├¬s', icon: 'speed', unlocked: false },
+];
+
+const STORAGE_KEY = 'wms_gamification_profiles';
+
+// ========================
+// SERVICE
+// ========================
+
+export class GamificationService {
+    private profiles: Map<string, GamificationProfile> = new Map();
+    private initialized: boolean = false;
+
+    async init(): Promise<void> {
+        if (this.initialized) return;
+        try {
+            // 1. Fetch Profiles
+            const { data: profileData } = await supabase.from('gamification_profiles').select('*');
+            // 2. Fetch Achievements
+            const { data: achievementData } = await supabase.from('gamification_achievements').select('*');
+
+            if (profileData) {
+                for (const p of profileData) {
+                    const profileAchievements = (achievementData || [])
+                        .filter(a => a.user_id === p.user_id)
+                        .map(a => a.id);
+
+                    this.profiles.set(p.user_id, {
+                        userId: p.user_id,
+                        userName: '', // We'll fill this from auth/users later or link join
+                        xpMonthly: p.xp_monthly,
+                        xpTotal: p.xp_total,
+                        currentLevel: p.current_level,
+                        sprMonthly: p.spr_monthly,
+                        fraudFlag: p.fraud_flag,
+                        fraudAlerts: p.fraud_alerts as string[],
+                        badges: DEFAULT_ACHIEVEMENTS.map(a => ({
+                            ...a,
+                            unlocked: profileAchievements.includes(a.id),
+                            unlockedAt: achievementData?.find(ad => ad.user_id === p.user_id && ad.id === a.id)?.unlocked_at
+                        })),
+                        performanceLogs: [], // Log history can be complex, skipping for now as not critical for current view
+                        dailyScans: {},
+                        dailyErrors: {},
+                        consecutiveDaysAboveMeta: 0,
+                        lastScanTimestamps: [],
+                    });
+                }
+            }
+            this.initialized = true;
+        } catch (e) {
+            console.error("Gamification init failed", e);
+        }
+    }
+
+    private async save(userId: string): Promise<void> {
+        const profile = this.profiles.get(userId);
+        if (!profile) return;
+
+        await supabase.from('gamification_profiles').upsert({
+            user_id: userId,
+            xp_monthly: profile.xpMonthly,
+            xp_total: profile.xpTotal,
+            current_level: profile.currentLevel,
+            spr_monthly: profile.sprMonthly,
+            fraud_flag: profile.fraudFlag,
+            fraud_alerts: profile.fraudAlerts,
+            updated_at: new Date().toISOString()
+        });
+    }
+
+    async getProfile(userId: string): Promise<GamificationProfile | undefined> {
+        if (!this.initialized) await this.init();
+        return this.profiles.get(userId);
+    }
+
+    async getAllProfiles(): Promise<GamificationProfile[]> {
+        if (!this.initialized) await this.init();
+        return Array.from(this.profiles.values());
+    }
+
+    private ensureProfile(userId: string, userName: string): GamificationProfile {
+        if (!this.profiles.has(userId)) {
+            this.profiles.set(userId, {
+                userId,
+                userName,
+                xpMonthly: 0,
+                xpTotal: 0,
+                currentLevel: 'Ferro',
+                sprMonthly: 0,
+                badges: DEFAULT_ACHIEVEMENTS.map(a => ({ ...a })),
+                fraudFlag: false,
+                fraudAlerts: [],
+                performanceLogs: [],
+                dailyScans: {},
+                dailyErrors: {},
+                consecutiveDaysAboveMeta: 0,
+                lastScanTimestamps: [],
+            });
+        }
+        const p = this.profiles.get(userId)!;
+        if (userName && p.userName !== userName) p.userName = userName;
+        return p;
+    }
+
+    // ========================
+    // SPR CALCULATION
+    // ========================
+    calculateSPR(totalScans: number, metaPercent: number, diasAcimaMeta: number, erros: number): number {
+        const raw = (totalScans * 0.5) + (metaPercent * 5) + (diasAcimaMeta * 20) - (erros * 30);
+        return Math.max(0, Math.round(raw));
+    }
+
+    // ========================
+    // XP CALCULATION
+    // ========================
+    calculateXP(spr: number): number {
+        return Math.round(spr * 1.2);
+    }
+
+    // ========================
+    // LEVEL DETERMINATION
+    // ========================
+    getLevel(xp: number): GamificationLevel {
+        let level = LEVELS[0];
+        for (const l of LEVELS) {
+            if (xp >= l.minXP) level = l;
+        }
+        return level;
+    }
+
+    getNextLevel(xp: number): GamificationLevel | null {
+        for (const l of LEVELS) {
+            if (l.minXP > xp) return l;
+        }
+        return null;
+    }
+
+    // ========================
+    // FULL RECALCULATION
+    // ========================
+    async recalculate(
+        userId: string,
+        userName: string,
+        totalScans: number,
+        metaPercent: number,
+        diasAcimaMeta: number,
+        erros: number,
+        monthlyTotalScans: number,
+        isTop1: boolean,
+        isTop3Weekly: boolean,
+        consecutiveDays: number,
+        zeroErrorDays: number,
+        avgMetaPercent: number,
+    ): Promise<GamificationProfile> {
+        const profile = this.ensureProfile(userId, userName);
+
+        // Check monthly reset
+        const currentMonth = new Date().toISOString().slice(0, 7);
+        const lastLog = profile.performanceLogs[profile.performanceLogs.length - 1];
+        if (lastLog && lastLog.mesReferencia !== currentMonth) {
+            profile.xpMonthly = 0;
+            profile.sprMonthly = 0;
+        }
+
+        // Calculate SPR & XP
+        const spr = this.calculateSPR(totalScans, metaPercent, diasAcimaMeta, erros);
+        const xp = this.calculateXP(spr);
+
+        profile.sprMonthly = spr;
+        profile.xpMonthly = xp;
+        profile.xpTotal = Math.max(profile.xpTotal, xp); // Record best highscore as total or cumulative? For now let's use highscore
+        profile.consecutiveDaysAboveMeta = consecutiveDays;
+
+        // Determine level
+        let level = this.getLevel(xp);
+        if (level.name === 'Desafiante' && !isTop1) {
+            level = LEVELS[8]; // Gr├úo-Mestre
+        }
+        profile.currentLevel = level.name;
+
+        // Check achievements
+        await this.checkAchievements(profile, monthlyTotalScans, consecutiveDays, zeroErrorDays, isTop3Weekly, avgMetaPercent);
+
+        // Apply fraud penalty
+        if (profile.fraudFlag) {
+            profile.xpMonthly = Math.round(profile.xpMonthly * 0.8);
+        }
+
+        // Update log
+        const logEntry: PerformanceLog = {
+            userId, userName, totalScans, metaPercent, diasAcimaMeta, erros, spr, xp: profile.xpMonthly, mesReferencia: currentMonth
+        };
+
+        const existingIdx = profile.performanceLogs.findIndex(l => l.mesReferencia === currentMonth);
+        if (existingIdx >= 0) {
+            profile.performanceLogs[existingIdx] = logEntry;
+        } else {
+            profile.performanceLogs.push(logEntry);
+        }
+
+        await this.save(userId);
+        return profile;
+    }
+
+    // ========================
+    // ACHIEVEMENTS
+    // ========================
+    private async checkAchievements(
+        profile: GamificationProfile,
+        monthlyScans: number,
+        consecutiveDays: number,
+        zeroErrorDays: number,
+        isTop3Weekly: boolean,
+        avgMetaPercent: number,
+    ): Promise<void> {
+        const unlock = async (id: string) => {
+            const badge = profile.badges.find(b => b.id === id);
+            if (badge && !badge.unlocked) {
+                badge.unlocked = true;
+                badge.unlockedAt = new Date().toISOString();
+
+                await supabase.from('gamification_achievements').insert({
+                    id,
+                    user_id: profile.userId,
+                    unlocked_at: badge.unlockedAt
+                });
+            }
+        };
+
+        if (consecutiveDays >= 10) await unlock('streak_10');
+        if (monthlyScans >= 1000) await unlock('scans_1000');
+        if (zeroErrorDays >= 30) await unlock('zero_errors_30');
+        if (isTop3Weekly) await unlock('top3_weekly');
+        if (avgMetaPercent >= 110) await unlock('avg_110');
+    }
+
+    // ========================
+    // ANTI-FRAUD
+    // ========================
+    async registerScan(userId: string, userName: string): Promise<{ suspicious: boolean; reason?: string }> {
+        const profile = this.ensureProfile(userId, userName);
+        const now = Date.now();
+
+        profile.lastScanTimestamps.push(now);
+        if (profile.lastScanTimestamps.length > 20) profile.lastScanTimestamps = profile.lastScanTimestamps.slice(-20);
+
+        const timestamps = profile.lastScanTimestamps;
+
+        // Check 1: Speed
+        if (timestamps.length >= 10) {
+            const last10 = timestamps.slice(-10);
+            const span = (last10[last10.length - 1] - last10[0]) / 1000;
+            if (span < 20) {
+                profile.fraudAlerts.push(`${new Date().toLocaleString()} - Velocidade suspeita: ${(10 / span).toFixed(1)} scans/s`);
+                profile.fraudFlag = true;
+                await this.save(userId);
+                return { suspicious: true, reason: 'Velocidade de scan suspeita detectada' };
+            }
+        }
+
+        // Check 2: Robot pattern
+        if (timestamps.length >= 6) {
+            const last6 = timestamps.slice(-6);
+            const intervals = [];
+            for (let i = 1; i < last6.length; i++) intervals.push(last6[i] - last6[i - 1]);
+            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
+            const allSimilar = intervals.every(iv => Math.abs(iv - avgInterval) < 100);
+            if (allSimilar && avgInterval < 3000) {
+                profile.fraudAlerts.push(`${new Date().toLocaleString()} - Padr├úo repetitivo: intervalo constante de ${Math.round(avgInterval)}ms`);
+                profile.fraudFlag = true;
+                await this.save(userId);
+                return { suspicious: true, reason: 'Padr├úo repetitivo de scan detectado' };
+            }
+        }
+
+        await this.save(userId);
+        return { suspicious: false };
+    }
+
+    async clearFraudFlag(userId: string): Promise<void> {
+        const profile = this.profiles.get(userId);
+        if (profile) {
+            profile.fraudFlag = false;
+            await this.save(userId);
+        }
+    }
+
+    // ========================
+    // RANKING
+    // ========================
+    async getMonthlyRanking(): Promise<GamificationProfile[]> {
+        if (!this.initialized) await this.init();
+        return Array.from(this.profiles.values())
+            .filter(p => p.sprMonthly > 0)
+            .sort((a, b) => b.sprMonthly - a.sprMonthly);
+    }
+}
+
+// Singleton
+export const gamificationService = new GamificationService();
