import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  HelpArticleStatus,
  HelpArticleType,
  HelpAudience,
  HelpCategory,
  HelpCategoryStatus,
  HelpTargetRole,
  OnboardingGuideStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  HelpFeedbackDto,
  OnboardingProgressDto,
  UpsertHelpArticleDto,
  UpsertHelpCategoryDto,
} from './dto/upsert-help-article.dto';

type Actor = {
  id?: string;
  role?: string;
  organizationId?: string;
  associationId?: string;
};

const ADMIN_GUIDE_KEY = 'ADMIN_FIRST_SETUP';

const CATEGORY_SEEDS = [
  ['getting-started', 'Primii pasi', 'Ghiduri pentru configurarea initiala.', ['PUBLIC', 'ADMIN', 'STAFF']],
  ['superadmin', 'Superadmin', 'Operare platforma, clienti APC si suport.', ['SUPERADMIN']],
  ['admin-basics', 'Administrare APC', 'Operatiuni de baza pentru administratori.', ['ADMIN', 'STAFF']],
  ['apartments-residents', 'Apartamente si locatari', 'Date de baza pentru condominiu.', ['ADMIN', 'STAFF']],
  ['tariffs-billing', 'Tarife si facturare', 'Configurare tarife, drafturi si facturi.', ['ADMIN', 'STAFF']],
  ['invoices-payments', 'Facturi si plati', 'Facturi, solduri si incasari.', ['ADMIN', 'STAFF', 'RESIDENT']],
  ['meters-readings', 'Contoare si indici', 'Transmitere si aprobare indici.', ['ADMIN', 'STAFF', 'RESIDENT']],
  ['resident-portal', 'Portal locatar', 'Ajutor simplu pentru locatari.', ['RESIDENT', 'PUBLIC']],
  ['announcements-requests', 'Anunturi si solicitari', 'Comunicare intre APC si locatari.', ['ADMIN', 'STAFF', 'RESIDENT']],
  ['imports-exports', 'Import si export', 'Lucrul cu CSV si exporturi.', ['ADMIN', 'STAFF']],
  ['data-quality', 'Calitatea datelor', 'Verificari inainte de facturare.', ['ADMIN', 'STAFF']],
  ['security-access', 'Securitate si acces', 'Roluri, invitatii si acces portal.', ['SUPERADMIN', 'ADMIN', 'STAFF']],
  ['reports', 'Rapoarte', 'Rapoarte financiare si consum.', ['ADMIN', 'STAFF']],
  ['troubleshooting', 'Depanare', 'Probleme frecvente si solutii.', ['PUBLIC', 'ADMIN', 'STAFF', 'RESIDENT']],
] as const;

const ARTICLE_SEEDS: Array<{
  slug: string;
  title: string;
  categorySlug: string;
  audiences: HelpAudience[];
  type?: HelpArticleType;
  route?: string;
  module?: string;
  featured?: boolean;
  body: string;
}> = [
  {
    slug: 'cum-activez-o-asociatie-apc',
    title: 'Cum activez o asociatie APC?',
    categorySlug: 'superadmin',
    audiences: [HelpAudience.SUPERADMIN],
    route: '/superadmin/associations',
    module: 'ASSOCIATIONS',
    featured: true,
    body: '## Pe scurt\n1. Creeaza asociatia.\n2. Verifica datele legale si contactele.\n3. Configureaza abonamentul SaaS.\n4. Invita administratorul APC.\n\nImportant: nu activa asociatia pana cand datele de contact nu sunt confirmate.',
  },
  {
    slug: 'cum-adaug-apartamente',
    title: 'Cum adaug apartamente?',
    categorySlug: 'apartments-residents',
    audiences: [HelpAudience.ADMIN, HelpAudience.STAFF],
    route: '/admin/apartments',
    module: 'APARTMENTS',
    featured: true,
    body: '## Adaugare manuala\nDeschide Apartamente si foloseste actiunea Adauga apartament. Completeaza numarul, scara si suprafata daca este disponibila.\n\n## Recomandare\nPentru liste mari foloseste import CSV, apoi ruleaza Data Quality.',
  },
  {
    slug: 'cum-import-apartamente-din-csv',
    title: 'Cum import apartamente din CSV?',
    categorySlug: 'imports-exports',
    audiences: [HelpAudience.ADMIN, HelpAudience.STAFF],
    route: '/admin/imports',
    module: 'IMPORTS',
    body: 'Pregateste fisierul CSV cu coloane clare pentru numar apartament, scara si suprafata. Dupa incarcare, verifica randurile cu eroare inainte de confirmare.',
  },
  {
    slug: 'cum-adaug-locatari',
    title: 'Cum adaug locatari?',
    categorySlug: 'apartments-residents',
    audiences: [HelpAudience.ADMIN, HelpAudience.STAFF],
    route: '/admin/residents',
    module: 'RESIDENTS',
    body: 'Adauga locatarul din pagina Locatari sau din detaliul apartamentului. Leaga locatarul de apartament si seteaza tipul relatiei: proprietar, chirias sau contact.',
  },
  {
    slug: 'cum-setez-contactul-principal',
    title: 'Cum setez contactul principal?',
    categorySlug: 'apartments-residents',
    audiences: [HelpAudience.ADMIN, HelpAudience.STAFF],
    module: 'RESIDENTS',
    body: 'Contactul principal primeste comunicarile importante. In detaliul apartamentului, alege locatarul potrivit si marcheaza-l ca principal.',
  },
  {
    slug: 'cum-configurez-tarife',
    title: 'Cum configurez tarife?',
    categorySlug: 'tariffs-billing',
    audiences: [HelpAudience.ADMIN, HelpAudience.STAFF],
    route: '/admin/tariffs',
    module: 'TARIFFS',
    featured: true,
    body: 'Configureaza tarifele recurente inainte de calcularea draftului. Verifica baza de calcul: per apartament, per persoana, per suprafata sau dupa consum.',
  },
  {
    slug: 'cum-calculez-draftul-de-facturi',
    title: 'Cum calculez draftul de facturi?',
    categorySlug: 'tariffs-billing',
    audiences: [HelpAudience.ADMIN, HelpAudience.STAFF],
    route: '/admin/billing',
    module: 'BILLING',
    featured: true,
    body: 'Alege luna de facturare, ruleaza verificarile si calculeaza draftul. Revizuieste totalurile inainte de blocare.',
  },
  {
    slug: 'cum-revizuiesc-si-blochez-draftul',
    title: 'Cum revizuiesc si blochez draftul?',
    categorySlug: 'tariffs-billing',
    audiences: [HelpAudience.ADMIN, HelpAudience.STAFF],
    module: 'BILLING',
    body: 'Verifica apartamentele fara date, tarifele lipsa si sumele neobisnuite. Dupa blocare, draftul devine baza pentru facturile finale.',
  },
  {
    slug: 'cum-generez-facturile-finale',
    title: 'Cum generez facturile finale?',
    categorySlug: 'tariffs-billing',
    audiences: [HelpAudience.ADMIN, HelpAudience.STAFF],
    route: '/admin/invoices',
    module: 'INVOICES',
    featured: true,
    body: 'Dupa ce draftul este blocat, foloseste Generare facturi finale. Facturile devin vizibile pentru locatari in portal.',
  },
  {
    slug: 'cum-inregistrez-o-plata',
    title: 'Cum inregistrez o plata?',
    categorySlug: 'invoices-payments',
    audiences: [HelpAudience.ADMIN, HelpAudience.STAFF],
    route: '/admin/payments',
    module: 'PAYMENTS',
    body: 'Deschide Plati si alege factura sau apartamentul. Completeaza suma, metoda, data platii si referinta, apoi salveaza.',
  },
  {
    slug: 'cum-verific-restantele',
    title: 'Cum verific restantele?',
    categorySlug: 'invoices-payments',
    audiences: [HelpAudience.ADMIN, HelpAudience.STAFF],
    module: 'PAYMENTS',
    body: 'Foloseste filtrele dupa status si sold restant. Rapoartele financiare arata totalul facturat, incasat si soldul ramas.',
  },
  {
    slug: 'cum-folosesc-data-quality-center',
    title: 'Cum folosesc Data Quality Center?',
    categorySlug: 'data-quality',
    audiences: [HelpAudience.ADMIN, HelpAudience.STAFF],
    route: '/admin/data-quality',
    module: 'DATA_QUALITY',
    body: 'Ruleaza verificarile inainte de facturare. Rezolva erorile critice si analizeaza warning-urile pentru date incomplete.',
  },
  {
    slug: 'cum-import-contoare-si-indici',
    title: 'Cum import contoare si indici?',
    categorySlug: 'meters-readings',
    audiences: [HelpAudience.ADMIN, HelpAudience.STAFF],
    module: 'METERS',
    body: 'Importa contoarele si indicii prin CSV sau adauga-le manual. Verifica unitatea de masura si ultimul indice aprobat.',
  },
  {
    slug: 'cum-aprob-indicii-transmisi',
    title: 'Cum aprob indicii transmisi?',
    categorySlug: 'meters-readings',
    audiences: [HelpAudience.ADMIN, HelpAudience.STAFF],
    route: '/admin/meter-readings',
    module: 'METER_READINGS',
    body: 'Verifica indicii trimisi de locatari, compara cu valoarea anterioara si aproba sau respinge cu motiv clar.',
  },
  {
    slug: 'cum-creez-anunturi',
    title: 'Cum creez anunturi?',
    categorySlug: 'announcements-requests',
    audiences: [HelpAudience.ADMIN, HelpAudience.STAFF],
    route: '/admin/announcements',
    module: 'ANNOUNCEMENTS',
    body: 'Scrie un titlu scurt, continut clar si alege vizibilitatea. Pentru urgente, foloseste prioritatea potrivita.',
  },
  {
    slug: 'cum-gestionez-solicitarile-locatarilor',
    title: 'Cum gestionez solicitarile locatarilor?',
    categorySlug: 'announcements-requests',
    audiences: [HelpAudience.ADMIN, HelpAudience.STAFF],
    route: '/admin/requests',
    module: 'REQUESTS',
    body: 'Grupeaza solicitarile dupa status si prioritate. Raspunde in timeline si actualizeaza statusul cand problema evolueaza.',
  },
  {
    slug: 'cum-invit-locatarii-in-portal',
    title: 'Cum invit locatarii in portal?',
    categorySlug: 'security-access',
    audiences: [HelpAudience.ADMIN, HelpAudience.STAFF],
    route: '/admin/resident-access',
    module: 'RESIDENT_ACCESS',
    body: 'Invita locatarii dupa ce emailul sau telefonul este verificat. Linkurile de invitatie sunt personale si nu trebuie distribuite altor persoane.',
  },
  {
    slug: 'cum-gestionez-echipa-si-rolurile',
    title: 'Cum gestionez echipa si rolurile?',
    categorySlug: 'security-access',
    audiences: [HelpAudience.ADMIN, HelpAudience.STAFF],
    route: '/admin/team',
    module: 'TEAM',
    body: 'Invita membrii echipei si atribuie rolul potrivit. Pastreaza accesul minim necesar pentru fiecare persoana.',
  },
  {
    slug: 'cum-imi-activez-contul',
    title: 'Cum imi activez contul?',
    categorySlug: 'resident-portal',
    audiences: [HelpAudience.RESIDENT, HelpAudience.PUBLIC],
    route: '/resident',
    module: 'RESIDENT_PORTAL',
    featured: true,
    body: 'Deschide linkul primit de la administrator, seteaza parola si verifica datele de contact. Daca linkul a expirat, cere o invitatie noua.',
  },
  {
    slug: 'cum-vad-facturile',
    title: 'Cum vad facturile?',
    categorySlug: 'invoices-payments',
    audiences: [HelpAudience.RESIDENT, HelpAudience.PUBLIC],
    route: '/resident/invoices',
    module: 'RESIDENT_INVOICES',
    featured: true,
    body: 'In portal, deschide Facturi. Vezi luna, suma totala, suma achitata, soldul si scadenta.',
  },
  {
    slug: 'cum-vad-istoricul-platilor',
    title: 'Cum vad istoricul platilor?',
    categorySlug: 'invoices-payments',
    audiences: [HelpAudience.RESIDENT],
    route: '/resident/payments',
    module: 'RESIDENT_PAYMENTS',
    body: 'Deschide Plati pentru a vedea confirmarile inregistrate de administrator si factura aferenta fiecarei plati.',
  },
  {
    slug: 'cum-transmit-indicii-contoarelor',
    title: 'Cum transmit indicii contoarelor?',
    categorySlug: 'meters-readings',
    audiences: [HelpAudience.RESIDENT],
    route: '/resident/meter-readings/new',
    module: 'RESIDENT_METERS',
    body: 'Alege contorul, introdu valoarea citita si trimite. Administratorul va aproba sau respinge indicele.',
  },
  {
    slug: 'cum-trimit-o-solicitare',
    title: 'Cum trimit o solicitare?',
    categorySlug: 'announcements-requests',
    audiences: [HelpAudience.RESIDENT],
    route: '/resident/requests/new',
    module: 'RESIDENT_REQUESTS',
    body: 'Deschide Solicitari, apasa Creeaza solicitare, alege categoria si descrie problema cat mai clar.',
  },
  {
    slug: 'cum-citesc-anunturile',
    title: 'Cum citesc anunturile?',
    categorySlug: 'announcements-requests',
    audiences: [HelpAudience.RESIDENT],
    route: '/resident/announcements',
    module: 'RESIDENT_ANNOUNCEMENTS',
    body: 'Anunturile apar in Avizier. Cele urgente sunt evidentiate si ar trebui citite primele.',
  },
  {
    slug: 'cum-modific-preferintele-de-contact',
    title: 'Cum modific preferintele de contact?',
    categorySlug: 'resident-portal',
    audiences: [HelpAudience.RESIDENT],
    route: '/resident/profile',
    module: 'RESIDENT_PROFILE',
    body: 'Deschide Cont si actualizeaza preferintele disponibile. Pentru date care necesita validare, trimite o cerere de actualizare.',
  },
  {
    slug: 'ce-fac-daca-nu-pot-accesa-portalul',
    title: 'Ce fac daca nu pot accesa portalul?',
    categorySlug: 'troubleshooting',
    audiences: [HelpAudience.RESIDENT, HelpAudience.PUBLIC],
    body: 'Verifica emailul, parola si linkul de invitatie. Daca accesul este blocat, contacteaza administratorul APC.',
  },
  {
    slug: 'cum-salvez-factura-ca-pdf',
    title: 'Cum salvez factura ca PDF?',
    categorySlug: 'resident-portal',
    audiences: [HelpAudience.RESIDENT],
    route: '/resident/invoices',
    module: 'DOCUMENTS',
    body: 'Deschide factura si foloseste Print / Save as PDF. Documentul este pentru evidenta interna, nu document fiscal oficial.',
  },
  {
    slug: 'cum-gestionez-planurile-saas',
    title: 'Cum gestionez planurile SaaS?',
    categorySlug: 'superadmin',
    audiences: [HelpAudience.SUPERADMIN],
    route: '/superadmin/billing/plans',
    module: 'SAAS_PLANS',
    body: 'Planurile definesc limitele si feature-urile disponibile pentru APC. Modificarile trebuie facute controlat pentru a pastra istoricul abonamentelor.',
  },
  {
    slug: 'cum-gestionez-abonamentele',
    title: 'Cum gestionez abonamentele?',
    categorySlug: 'superadmin',
    audiences: [HelpAudience.SUPERADMIN],
    route: '/superadmin/billing/subscriptions',
    module: 'SAAS_SUBSCRIPTIONS',
    body: 'Abonamentele leaga o asociatie de un plan. Verifica statusul, perioada curenta, trialul si evenimentele inainte de schimbari.',
  },
  {
    slug: 'cum-folosesc-support-access',
    title: 'Cum folosesc Support Access?',
    categorySlug: 'superadmin',
    audiences: [HelpAudience.SUPERADMIN],
    route: '/superadmin/support-access',
    module: 'SUPPORT_ACCESS',
    body: 'Foloseste accesul de suport doar pentru investigatii justificate. Pastreaza notele clare si revoca accesul cand nu mai este necesar.',
  },
  {
    slug: 'cum-verific-security-center',
    title: 'Cum verific Security Center?',
    categorySlug: 'security-access',
    audiences: [HelpAudience.SUPERADMIN],
    route: '/superadmin/security',
    module: 'SECURITY',
    body: 'Security Center centralizeaza evenimente sensibile. Investigheaza evenimentele high severity si actiunile cross-tenant.',
  },
  {
    slug: 'cum-verific-monitoring',
    title: 'Cum verific Monitoring?',
    categorySlug: 'superadmin',
    audiences: [HelpAudience.SUPERADMIN],
    route: '/superadmin/monitoring',
    module: 'MONITORING',
    body: 'Monitoring arata health checks, erori si informatii despre deploy. Porneste de la statusul global si investigheaza erorile critice.',
  },
  {
    slug: 'cum-configurez-notificarile-email-sms',
    title: 'Cum configurez notificarile email/SMS?',
    categorySlug: 'superadmin',
    audiences: [HelpAudience.SUPERADMIN],
    route: '/superadmin/notifications',
    module: 'NOTIFICATIONS',
    body: 'Providerii se configureaza prin environment variables. In UI vezi doar statusul configurarii, fara secrete.',
  },
];

const ADMIN_ONBOARDING_STEPS = [
  ['APC_DETAILS', 'Verifica datele APC', '/admin/settings', 'Confirma denumirea, adresa si contactele asociatiei.'],
  ['APARTMENTS_IMPORTED', 'Adauga/importa apartamente', '/admin/apartments', 'Creeaza lista de apartamente sau importa din CSV.'],
  ['RESIDENTS_IMPORTED', 'Adauga/importa locatari', '/admin/residents', 'Leaga locatarii de apartamente.'],
  ['PRIMARY_CONTACTS_SET', 'Seteaza contact principal', '/admin/residents', 'Alege contactul principal pentru comunicari.'],
  ['TARIFFS_CONFIGURED', 'Configureaza tarife', '/admin/tariffs', 'Adauga tarifele lunare si regulile de calcul.'],
  ['METERS_ADDED', 'Adauga contoare', '/admin/meters', 'Configureaza contoarele daca asociatia foloseste consum.'],
  ['READINGS_IMPORTED', 'Importa/transmite indici', '/admin/meter-readings', 'Adauga indicii pentru perioada curenta.'],
  ['DATA_QUALITY_RUN', 'Ruleaza Data Quality', '/admin/data-quality', 'Rezolva erorile critice inainte de facturare.'],
  ['DRAFT_CALCULATED', 'Calculeaza draftul de facturi', '/admin/billing', 'Genereaza draftul lunii.'],
  ['DRAFT_LOCKED', 'Revizuieste si blocheaza draftul', '/admin/billing', 'Verifica sumele si blocheaza draftul.'],
  ['INVOICES_GENERATED', 'Genereaza facturile', '/admin/invoices', 'Transforma draftul in facturi finale.'],
  ['PAYMENTS_RECORDED', 'Inregistreaza plati', '/admin/payments', 'Adauga primele plati manuale.'],
  ['ANNOUNCEMENT_PUBLISHED', 'Publica anunturi', '/admin/announcements', 'Anunta locatarii despre folosirea portalului.'],
  ['RESIDENTS_INVITED', 'Invita locatarii in portal', '/admin/resident-access', 'Trimite invitatii pentru acces resident.'],
].map(([id, title, href, description]) => ({ id, title, href, description }));

@Injectable()
export class HelpService {
  private seeded = false;

  constructor(private readonly prisma: PrismaService) {}

  private roleToAudience(role?: string): HelpAudience {
    const upper = String(role || '').toUpperCase();
    if (upper === 'SUPERADMIN' || upper === 'SUPER_ADMIN') return HelpAudience.SUPERADMIN;
    if (upper === 'RESIDENT') return HelpAudience.RESIDENT;
    if (upper === 'STAFF') return HelpAudience.STAFF;
    return HelpAudience.ADMIN;
  }

  private audiencesForReader(role?: string): HelpAudience[] {
    const audience = this.roleToAudience(role);
    if (audience === HelpAudience.SUPERADMIN) return [HelpAudience.PUBLIC, HelpAudience.SUPERADMIN, HelpAudience.ADMIN, HelpAudience.STAFF, HelpAudience.RESIDENT];
    if (audience === HelpAudience.RESIDENT) return [HelpAudience.PUBLIC, HelpAudience.RESIDENT];
    return [HelpAudience.PUBLIC, HelpAudience.ADMIN, HelpAudience.STAFF];
  }

  private slugify(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[ăâ]/gi, 'a')
      .replace(/[î]/gi, 'i')
      .replace(/[șş]/gi, 's')
      .replace(/[țţ]/gi, 't')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 220);
  }

  private legacyRole(audiences: HelpAudience[]): HelpTargetRole {
    if (audiences.includes(HelpAudience.SUPERADMIN)) return HelpTargetRole.SUPER_ADMIN;
    if (audiences.includes(HelpAudience.ADMIN) || audiences.includes(HelpAudience.STAFF)) return HelpTargetRole.ADMIN;
    if (audiences.includes(HelpAudience.RESIDENT)) return HelpTargetRole.RESIDENT;
    return HelpTargetRole.ALL;
  }

  private legacyCategory(slug?: string): HelpCategory {
    if (slug === 'invoices-payments') return HelpCategory.INVOICES;
    if (slug === 'apartments-residents') return HelpCategory.RESIDENTS;
    if (slug === 'getting-started') return HelpCategory.GETTING_STARTED;
    if (slug === 'security-access') return HelpCategory.SETTINGS;
    if (slug === 'announcements-requests') return HelpCategory.ISSUES;
    return HelpCategory.OTHER;
  }

  private readMinutes(body: string) {
    return Math.max(1, Math.ceil(body.split(/\s+/).filter(Boolean).length / 180));
  }

  private async ensureSeedContent() {
    if (this.seeded) return;
    const categoryCount = await this.prisma.helpDocCategory.count();
    if (categoryCount === 0) {
      for (let index = 0; index < CATEGORY_SEEDS.length; index += 1) {
        const [slug, title, description, audience] = CATEGORY_SEEDS[index];
        await this.prisma.helpDocCategory.upsert({
          where: { slug },
          update: { title, description, audience: audience as unknown as Prisma.InputJsonValue, sortOrder: index },
          create: { slug, title, description, audience: audience as unknown as Prisma.InputJsonValue, sortOrder: index },
        });
      }
    }

    const categories = await this.prisma.helpDocCategory.findMany({ select: { id: true, slug: true } });
    const categoryBySlug = new Map(categories.map((item) => [item.slug, item.id]));
    for (let index = 0; index < ARTICLE_SEEDS.length; index += 1) {
      const seed = ARTICLE_SEEDS[index];
      const body = seed.body;
      await this.prisma.helpArticle.upsert({
        where: { slug: seed.slug },
        update: {
          categoryId: categoryBySlug.get(seed.categorySlug),
          excerpt: body.replace(/[#*\n]/g, ' ').trim().slice(0, 240),
          body,
          content: body,
          type: seed.type ?? HelpArticleType.HOW_TO,
          status: HelpArticleStatus.PUBLISHED,
          audience: seed.audiences as unknown as Prisma.InputJsonValue,
          targetRole: this.legacyRole(seed.audiences),
          category: this.legacyCategory(seed.categorySlug),
          tags: [seed.categorySlug, seed.module || 'help'].filter(Boolean) as unknown as Prisma.InputJsonValue,
          locale: 'ro',
          sortOrder: index,
          isFeatured: Boolean(seed.featured),
          isContextual: Boolean(seed.route || seed.module),
          relatedRoute: seed.route,
          relatedModule: seed.module,
          estimatedReadMinutes: this.readMinutes(body),
          isPublished: true,
          publishedAt: new Date(),
        },
        create: {
          categoryId: categoryBySlug.get(seed.categorySlug),
          title: seed.title,
          slug: seed.slug,
          excerpt: body.replace(/[#*\n]/g, ' ').trim().slice(0, 240),
          body,
          content: body,
          type: seed.type ?? HelpArticleType.HOW_TO,
          status: HelpArticleStatus.PUBLISHED,
          audience: seed.audiences as unknown as Prisma.InputJsonValue,
          targetRole: this.legacyRole(seed.audiences),
          category: this.legacyCategory(seed.categorySlug),
          tags: [seed.categorySlug, seed.module || 'help'].filter(Boolean) as unknown as Prisma.InputJsonValue,
          locale: 'ro',
          sortOrder: index,
          isFeatured: Boolean(seed.featured),
          isContextual: Boolean(seed.route || seed.module),
          relatedRoute: seed.route,
          relatedModule: seed.module,
          estimatedReadMinutes: this.readMinutes(body),
          isPublished: true,
          publishedAt: new Date(),
        },
      });
    }

    await this.prisma.onboardingGuide.upsert({
      where: { key: ADMIN_GUIDE_KEY },
      update: {
        title: 'Ghid de configurare APC',
        description: 'Primii pasi pentru configurarea asociatiei in Espace.',
        audience: HelpAudience.ADMIN,
        status: OnboardingGuideStatus.ACTIVE,
        steps: ADMIN_ONBOARDING_STEPS as unknown as Prisma.InputJsonValue,
      },
      create: {
        key: ADMIN_GUIDE_KEY,
        title: 'Ghid de configurare APC',
        description: 'Primii pasi pentru configurarea asociatiei in Espace.',
        audience: HelpAudience.ADMIN,
        status: OnboardingGuideStatus.ACTIVE,
        steps: ADMIN_ONBOARDING_STEPS as unknown as Prisma.InputJsonValue,
      },
    });
    this.seeded = true;
  }

  private articleWhereForAudiences(audiences: HelpAudience[], params?: Record<string, string | undefined>): Prisma.HelpArticleWhereInput {
    const search = params?.search?.trim();
    return {
      status: HelpArticleStatus.PUBLISHED,
      locale: params?.locale || 'ro',
      ...(params?.category ? { helpCategory: { slug: params.category } } : {}),
      ...(params?.type ? { type: params.type as HelpArticleType } : {}),
      ...(params?.route ? { relatedRoute: { contains: params.route, mode: 'insensitive' } } : {}),
      ...(params?.module ? { relatedModule: { equals: params.module, mode: 'insensitive' } } : {}),
      OR: [
        ...audiences.map((audience) => ({ audience: { array_contains: audience } })),
        ...(audiences.includes(HelpAudience.PUBLIC) ? [{ targetRole: HelpTargetRole.ALL }] : []),
      ],
      AND: search
        ? [
            {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { excerpt: { contains: search, mode: 'insensitive' } },
                { body: { contains: search, mode: 'insensitive' } },
                { content: { contains: search, mode: 'insensitive' } },
              ],
            },
          ]
        : undefined,
    };
  }

  private serializeArticle(article: any) {
    return {
      ...article,
      category: article.helpCategory
        ? {
            id: article.helpCategory.id,
            slug: article.helpCategory.slug,
            title: article.helpCategory.title,
            description: article.helpCategory.description,
          }
        : article.category,
      body: article.body || article.content,
      content: article.content || article.body,
      audience: article.audience || [article.targetRole === 'ALL' ? HelpAudience.PUBLIC : article.targetRole],
    };
  }

  async getHelpHome(actor?: Actor, audienceOverride?: HelpAudience) {
    await this.ensureSeedContent();
    const audiences = audienceOverride ? [HelpAudience.PUBLIC, audienceOverride] : this.audiencesForReader(actor?.role);
    const [categories, featured, articles] = await Promise.all([
      this.listCategoriesForAudiences(audiences),
      this.prisma.helpArticle.findMany({
        where: { ...this.articleWhereForAudiences(audiences), isFeatured: true },
        include: { helpCategory: true },
        orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
        take: 8,
      }),
      this.prisma.helpArticle.findMany({
        where: this.articleWhereForAudiences(audiences),
        include: { helpCategory: true },
        orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
        take: 24,
      }),
    ]);
    return { categories, featured: featured.map((item) => this.serializeArticle(item)), articles: articles.map((item) => this.serializeArticle(item)) };
  }

  async listCategoriesForAudiences(audiences: HelpAudience[]) {
    await this.ensureSeedContent();
    const categories = await this.prisma.helpDocCategory.findMany({
      where: {
        status: HelpCategoryStatus.ACTIVE,
        OR: audiences.map((audience) => ({ audience: { array_contains: audience } })),
      },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
    return categories;
  }

  async listArticles(actor: Actor | undefined, params?: Record<string, string | undefined>, audienceOverride?: HelpAudience) {
    await this.ensureSeedContent();
    const audiences = audienceOverride ? [HelpAudience.PUBLIC, audienceOverride] : this.audiencesForReader(actor?.role);
    const page = Math.max(1, Number(params?.page || 1));
    const limit = Math.min(50, Math.max(1, Number(params?.limit || 20)));
    const where = this.articleWhereForAudiences(audiences, params);
    const [items, total] = await Promise.all([
      this.prisma.helpArticle.findMany({
        where,
        include: { helpCategory: true },
        orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.helpArticle.count({ where }),
    ]);
    return { items: items.map((item) => this.serializeArticle(item)), meta: { page, limit, total } };
  }

  async getArticleBySlug(actor: Actor | undefined, slug: string, audienceOverride?: HelpAudience) {
    await this.ensureSeedContent();
    const article = await this.prisma.helpArticle.findUnique({ where: { slug }, include: { helpCategory: true } });
    if (!article || article.status !== HelpArticleStatus.PUBLISHED) throw new NotFoundException('Article not found');
    const allowed = audienceOverride ? [HelpAudience.PUBLIC, audienceOverride] : this.audiencesForReader(actor?.role);
    const articleAudiences = Array.isArray(article.audience) ? (article.audience as HelpAudience[]) : [];
    const canRead = articleAudiences.some((item) => allowed.includes(item)) || (article.targetRole === HelpTargetRole.ALL && allowed.includes(HelpAudience.PUBLIC));
    if (!canRead) throw new NotFoundException('Article not found');
    const related = await this.prisma.helpArticle.findMany({
      where: {
        id: { not: article.id },
        status: HelpArticleStatus.PUBLISHED,
        categoryId: article.categoryId,
        OR: allowed.map((audience) => ({ audience: { array_contains: audience } })),
      },
      include: { helpCategory: true },
      orderBy: [{ isFeatured: 'desc' }, { updatedAt: 'desc' }],
      take: 4,
    });
    return { article: this.serializeArticle(article), relatedArticles: related.map((item) => this.serializeArticle(item)) };
  }

  async submitFeedback(actor: Actor | undefined, articleId: string, dto: HelpFeedbackDto) {
    await this.ensureSeedContent();
    const article = await this.prisma.helpArticle.findUnique({ where: { id: articleId }, select: { id: true } });
    if (!article) throw new NotFoundException('Article not found');
    await this.prisma.helpArticleFeedback.create({
      data: {
        articleId,
        userId: actor?.id,
        audience: this.roleToAudience(actor?.role),
        helpful: dto.helpful,
        comment: dto.comment?.slice(0, 1000),
        route: dto.route,
      },
    });
    return { ok: true, message: 'Multumim pentru feedback.' };
  }

  async contextualHelp(actor: Actor | undefined, params: { route?: string; module?: string }, audienceOverride?: HelpAudience) {
    const result = await this.listArticles(actor, { ...params, limit: '5' }, audienceOverride);
    return { route: params.route, module: params.module, items: result.items };
  }

  async adminOnboardingGuide(actor: Actor | undefined) {
    await this.ensureSeedContent();
    if (!actor?.id) throw new ForbiddenException('Authentication required');
    const associationId = actor.associationId || actor.organizationId || null;
    const [guide, progress] = await Promise.all([
      this.prisma.onboardingGuide.findUnique({ where: { key: ADMIN_GUIDE_KEY } }),
      this.prisma.userOnboardingProgress.findFirst({ where: { userId: actor.id, associationId, guideKey: ADMIN_GUIDE_KEY } }),
    ]);
    if (!guide) throw new NotFoundException('Onboarding guide not found');
    const completedSteps = Array.isArray(progress?.completedSteps) ? (progress?.completedSteps as string[]) : [];
    const steps = (guide.steps as any[]).map((step) => ({ ...step, completed: completedSteps.includes(step.id) }));
    return { guide: { ...guide, steps }, progress };
  }

  async updateAdminOnboardingProgress(actor: Actor | undefined, dto: OnboardingProgressDto) {
    await this.ensureSeedContent();
    if (!actor?.id) throw new ForbiddenException('Authentication required');
    const associationId = actor.associationId || actor.organizationId || null;
    const completedSteps = dto.completedSteps || [];
    const completedAt = completedSteps.length >= ADMIN_ONBOARDING_STEPS.length ? new Date() : null;
    return this.prisma.userOnboardingProgress.upsert({
      where: { userId_associationId_guideKey: { userId: actor.id, associationId, guideKey: dto.guideKey } },
      update: {
        completedSteps: completedSteps as unknown as Prisma.InputJsonValue,
        skippedSteps: (dto.skippedSteps || []) as unknown as Prisma.InputJsonValue,
        completedAt,
      },
      create: {
        userId: actor.id,
        associationId,
        guideKey: dto.guideKey,
        completedSteps: completedSteps as unknown as Prisma.InputJsonValue,
        skippedSteps: (dto.skippedSteps || []) as unknown as Prisma.InputJsonValue,
        completedAt,
      },
    });
  }

  async superadminListAll(params?: Record<string, string | undefined>) {
    await this.ensureSeedContent();
    const search = params?.search?.trim();
    return this.prisma.helpArticle.findMany({
      where: {
        ...(params?.status ? { status: params.status as HelpArticleStatus } : {}),
        ...(params?.type ? { type: params.type as HelpArticleType } : {}),
        ...(params?.categoryId ? { categoryId: params.categoryId } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { excerpt: { contains: search, mode: 'insensitive' } },
                { body: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { helpCategory: true },
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  async superadminGetArticle(id: string) {
    await this.ensureSeedContent();
    const article = await this.prisma.helpArticle.findUnique({ where: { id }, include: { helpCategory: true, feedback: { take: 10, orderBy: { createdAt: 'desc' } } } });
    if (!article) throw new NotFoundException('Article not found');
    return this.serializeArticle(article);
  }

  async superadminCreate(dto: UpsertHelpArticleDto, actor?: Actor) {
    const title = dto.title.trim();
    const slug = this.slugify(dto.slug || title);
    const body = (dto.body || dto.content || '').trim();
    if (!body) throw new ForbiddenException('Article body is required');
    const status = dto.status ?? (dto.isPublished ? HelpArticleStatus.PUBLISHED : HelpArticleStatus.DRAFT);
    const audiences = dto.audience?.length ? dto.audience : [HelpAudience.PUBLIC];
    return this.prisma.helpArticle.create({
      data: {
        title,
        slug,
        excerpt: dto.excerpt,
        categoryId: dto.categoryId,
        content: body,
        body,
        type: dto.type ?? HelpArticleType.GUIDE,
        status,
        audience: audiences as unknown as Prisma.InputJsonValue,
        tags: (dto.tags || []) as unknown as Prisma.InputJsonValue,
        locale: dto.locale || 'ro',
        sortOrder: dto.sortOrder ?? 0,
        isFeatured: dto.isFeatured ?? false,
        isContextual: dto.isContextual ?? false,
        relatedRoute: dto.relatedRoute,
        relatedModule: dto.relatedModule,
        estimatedReadMinutes: this.readMinutes(body),
        targetRole: dto.targetRole || this.legacyRole(audiences),
        category: dto.category || HelpCategory.OTHER,
        isPublished: status === HelpArticleStatus.PUBLISHED,
        publishedAt: status === HelpArticleStatus.PUBLISHED ? new Date() : undefined,
        createdById: actor?.id,
        updatedById: actor?.id,
      },
    });
  }

  async superadminUpdate(id: string, dto: Partial<UpsertHelpArticleDto>, actor?: Actor) {
    const existing = await this.prisma.helpArticle.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Article not found');
    const body = dto.body ?? dto.content;
    const status = dto.status ?? (dto.isPublished !== undefined ? (dto.isPublished ? HelpArticleStatus.PUBLISHED : HelpArticleStatus.DRAFT) : undefined);
    const audiences = dto.audience?.length ? dto.audience : undefined;
    return this.prisma.helpArticle.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.slug !== undefined ? { slug: this.slugify(dto.slug) } : {}),
        ...(dto.excerpt !== undefined ? { excerpt: dto.excerpt } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(body !== undefined ? { body, content: body, estimatedReadMinutes: this.readMinutes(body) } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(status !== undefined
          ? {
              status,
              isPublished: status === HelpArticleStatus.PUBLISHED,
              publishedAt: status === HelpArticleStatus.PUBLISHED && !existing.publishedAt ? new Date() : existing.publishedAt,
              archivedAt: status === HelpArticleStatus.ARCHIVED ? new Date() : null,
            }
          : {}),
        ...(audiences ? { audience: audiences as unknown as Prisma.InputJsonValue, targetRole: this.legacyRole(audiences) } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags as unknown as Prisma.InputJsonValue } : {}),
        ...(dto.locale !== undefined ? { locale: dto.locale } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isFeatured !== undefined ? { isFeatured: dto.isFeatured } : {}),
        ...(dto.isContextual !== undefined ? { isContextual: dto.isContextual } : {}),
        ...(dto.relatedRoute !== undefined ? { relatedRoute: dto.relatedRoute } : {}),
        ...(dto.relatedModule !== undefined ? { relatedModule: dto.relatedModule } : {}),
        ...(dto.targetRole !== undefined ? { targetRole: dto.targetRole } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        updatedById: actor?.id,
      },
    });
  }

  async superadminChangeStatus(id: string, status: HelpArticleStatus, actor?: Actor) {
    return this.superadminUpdate(id, { status }, actor);
  }

  async superadminDuplicate(id: string, actor?: Actor) {
    const article = await this.prisma.helpArticle.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');
    return this.prisma.helpArticle.create({
      data: {
        title: `${article.title} (copie)`,
        slug: `${article.slug}-copie-${Date.now()}`,
        excerpt: article.excerpt,
        categoryId: article.categoryId,
        content: article.content,
        body: article.body,
        type: article.type,
        status: HelpArticleStatus.DRAFT,
        audience: article.audience ?? Prisma.JsonNull,
        targetRole: article.targetRole,
        category: article.category,
        tags: article.tags ?? Prisma.JsonNull,
        locale: article.locale,
        sortOrder: article.sortOrder,
        isFeatured: false,
        isContextual: article.isContextual,
        relatedRoute: article.relatedRoute,
        relatedModule: article.relatedModule,
        estimatedReadMinutes: article.estimatedReadMinutes,
        isPublished: false,
        createdById: actor?.id,
        updatedById: actor?.id,
      },
    });
  }

  async superadminArchive(id: string, actor?: Actor) {
    await this.superadminChangeStatus(id, HelpArticleStatus.ARCHIVED, actor);
    return { ok: true };
  }

  async superadminListCategories() {
    await this.ensureSeedContent();
    return this.prisma.helpDocCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }] });
  }

  async superadminUpsertCategory(dto: UpsertHelpCategoryDto, actor?: Actor, id?: string) {
    const slug = this.slugify(dto.slug || dto.title);
    const data = {
      title: dto.title.trim(),
      slug,
      description: dto.description,
      icon: dto.icon,
      audience: (dto.audience || [HelpAudience.PUBLIC]) as unknown as Prisma.InputJsonValue,
      sortOrder: dto.sortOrder ?? 0,
      status: dto.status ?? HelpCategoryStatus.ACTIVE,
      updatedById: actor?.id,
    };
    if (id) return this.prisma.helpDocCategory.update({ where: { id }, data });
    return this.prisma.helpDocCategory.create({ data: { ...data, createdById: actor?.id } });
  }

  async superadminFeedback() {
    return this.prisma.helpArticleFeedback.findMany({
      include: { article: { select: { id: true, title: true, slug: true } }, user: { select: { id: true, email: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async superadminStats() {
    await this.ensureSeedContent();
    const [published, draft, archived, negativeFeedback, totalFeedback] = await Promise.all([
      this.prisma.helpArticle.count({ where: { status: HelpArticleStatus.PUBLISHED } }),
      this.prisma.helpArticle.count({ where: { status: HelpArticleStatus.DRAFT } }),
      this.prisma.helpArticle.count({ where: { status: HelpArticleStatus.ARCHIVED } }),
      this.prisma.helpArticleFeedback.count({ where: { helpful: false } }),
      this.prisma.helpArticleFeedback.count(),
    ]);
    return { published, draft, archived, negativeFeedback, totalFeedback };
  }
}
