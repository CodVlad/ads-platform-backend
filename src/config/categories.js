/**
 * Categories and subcategories configuration
 * This is the single source of truth for all categories in the system
 */
export const categories = [
  {
    slug: 'real-estate',
    label: 'Imobiliare',
    subcategories: [
      { slug: 'apartments-sale', label: 'Apartamente vânzare' },
      { slug: 'apartments-rent', label: 'Apartamente închiriat' },
      { slug: 'houses-villas', label: 'Case & vile' },
      { slug: 'lands', label: 'Terenuri' },
      { slug: 'commercial-spaces', label: 'Spații comerciale' },
      { slug: 'offices', label: 'Birouri' },
      { slug: 'garages-parking', label: 'Garaje & parcări' },
      { slug: 'abroad', label: 'Peste hotare' },
    ],
  },
  {
    slug: 'auto',
    label: 'Auto & Transport',
    subcategories: [
      { slug: 'cars', label: 'Autoturisme' },
      { slug: 'motorcycles', label: 'Motociclete & scutere' },
      { slug: 'trucks-buses', label: 'Camioane & autobuze' },
      { slug: 'agri-machinery', label: 'Utilaje agricole' },
      { slug: 'auto-parts', label: 'Piese auto' },
      { slug: 'tires-rims', label: 'Anvelope & jante' },
      { slug: 'auto-accessories', label: 'Accesorii auto' },
      { slug: 'auto-services', label: 'Servicii auto' },
    ],
  },
  {
    slug: 'electronics',
    label: 'Electronice & Tehnică',
    subcategories: [
      { slug: 'phones', label: 'Telefoane mobile' },
      { slug: 'laptops-pc', label: 'Laptopuri & PC' },
      { slug: 'tablets', label: 'Tablete' },
      { slug: 'tvs', label: 'Televizoare' },
      { slug: 'audio-video', label: 'Audio & video' },
      { slug: 'large-appliances', label: 'Electrocasnice mari' },
      { slug: 'small-appliances', label: 'Electrocasnice mici' },
      { slug: 'smart-home', label: 'Gadgeturi smart home' },
      { slug: 'games-consoles', label: 'Jocuri & console' },
    ],
  },
  {
    slug: 'fashion',
    label: 'Modă & Frumusețe',
    subcategories: [
      { slug: 'women-clothing', label: 'Îmbrăcăminte femei' },
      { slug: 'men-clothing', label: 'Îmbrăcăminte bărbați' },
      { slug: 'kids-clothing', label: 'Îmbrăcăminte copii' },
      { slug: 'shoes', label: 'Încălțăminte' },
      { slug: 'bags-accessories', label: 'Genți & accesorii' },
      { slug: 'watches', label: 'Ceasuri' },
      { slug: 'jewelry', label: 'Bijuterii' },
      { slug: 'cosmetics-perfume', label: 'Cosmetice & parfumuri' },
    ],
  },
  {
    slug: 'home-garden',
    label: 'Casă & Grădină',
    subcategories: [
      { slug: 'furniture', label: 'Mobilă' },
      { slug: 'decor', label: 'Decorațiuni' },
      { slug: 'textiles', label: 'Textile' },
      { slug: 'tools', label: 'Unelte & scule' },
      { slug: 'building-materials', label: 'Materiale construcții' },
      { slug: 'gardening', label: 'Grădinărit' },
      { slug: 'lighting', label: 'Iluminat' },
      { slug: 'heating-climate', label: 'Încălzire & climatizare' },
    ],
  },
  {
    slug: 'jobs',
    label: 'Locuri de muncă',
    subcategories: [
      { slug: 'it', label: 'IT & Tehnologie' },
      { slug: 'sales-marketing', label: 'Vânzări & marketing' },
      { slug: 'construction', label: 'Construcții' },
      { slug: 'logistics', label: 'Transport & logistică' },
      { slug: 'horeca', label: 'HORECA' },
      { slug: 'finance', label: 'Contabilitate & finanțe' },
      { slug: 'legal', label: 'Juridic' },
      { slug: 'education', label: 'Educație' },
      { slug: 'medical', label: 'Medicină' },
      { slug: 'freelance', label: 'Freelance & remote' },
    ],
  },
  {
    slug: 'services',
    label: 'Servicii',
    subcategories: [
      { slug: 'it-services', label: 'Servicii IT' },
      { slug: 'repairs', label: 'Reparații' },
      { slug: 'cleaning', label: 'Curățenie' },
      { slug: 'renovation', label: 'Construcții & renovări' },
      { slug: 'transport', label: 'Transport' },
      { slug: 'legal-services', label: 'Juridice' },
      { slug: 'accounting-services', label: 'Contabile' },
      { slug: 'marketing', label: 'Marketing & publicitate' },
      { slug: 'photo-video', label: 'Foto & video' },
      { slug: 'events', label: 'Evenimente' },
    ],
  },
  {
    slug: 'business',
    label: 'Afaceri & Echipamente',
    subcategories: [
      { slug: 'turnkey', label: 'Afaceri la cheie' },
      { slug: 'industrial', label: 'Echipamente industriale' },
      { slug: 'commercial-equipment', label: 'Echipamente comerciale' },
      { slug: 'machine-tools', label: 'Mașini & unelte' },
      { slug: 'franchises', label: 'Francize' },
      { slug: 'raw-materials', label: 'Materii prime' },
    ],
  },
  {
    slug: 'kids',
    label: 'Copii & Bebeluși',
    subcategories: [
      { slug: 'strollers', label: 'Cărucioare' },
      { slug: 'cribs', label: 'Pătuțuri' },
      { slug: 'toys', label: 'Jucării' },
      { slug: 'kids-clothes', label: 'Haine copii' },
      { slug: 'newborn', label: 'Nou-născuți' },
      { slug: 'education-games', label: 'Educație & jocuri' },
    ],
  },
  {
    slug: 'sports',
    label: 'Sport & Timp liber',
    subcategories: [
      { slug: 'bikes', label: 'Biciclete' },
      { slug: 'fitness', label: 'Fitness' },
      { slug: 'fishing', label: 'Pescuit' },
      { slug: 'hunting', label: 'Vânătoare' },
      { slug: 'camping', label: 'Turism & camping' },
      { slug: 'winter-sports', label: 'Sporturi iarnă' },
      { slug: 'board-games', label: 'Jocuri de societate' },
    ],
  },
  {
    slug: 'pets',
    label: 'Animale',
    subcategories: [
      { slug: 'dogs', label: 'Câini' },
      { slug: 'cats', label: 'Pisici' },
      { slug: 'birds', label: 'Păsări' },
      { slug: 'farm-animals', label: 'Fermă' },
      { slug: 'pet-products', label: 'Produse' },
      { slug: 'vet-services', label: 'Veterinare' },
    ],
  },
  {
    slug: 'agriculture',
    label: 'Agricultură',
    subcategories: [
      { slug: 'agri-tools', label: 'Utilaje' },
      { slug: 'seeds-plants', label: 'Semințe & plante' },
      { slug: 'agri-products', label: 'Produse' },
      { slug: 'feed', label: 'Furaje' },
      { slug: 'agri-services', label: 'Servicii' },
    ],
  },
  {
    slug: 'courses',
    label: 'Educație & Cursuri',
    subcategories: [
      { slug: 'tutoring', label: 'Meditații' },
      { slug: 'online', label: 'Cursuri online' },
      { slug: 'languages', label: 'Limbi străine' },
      { slug: 'it-coding', label: 'IT & programare' },
      { slug: 'self-development', label: 'Dezvoltare personală' },
    ],
  },
  {
    slug: 'misc',
    label: 'Diverse',
    subcategories: [
      { slug: 'collectibles', label: 'Colecție' },
      { slug: 'antiques', label: 'Antichități' },
      { slug: 'books', label: 'Cărți' },
      { slug: 'music', label: 'Instrumente muzicale' },
      { slug: 'other', label: 'Altele' },
    ],
  },
];

/**
 * Get category by slug
 * @param {string} categorySlug
 * @returns {object|null}
 */
export const getCategoryBySlug = (categorySlug) => {
  return categories.find((cat) => cat.slug === categorySlug) || null;
};

/**
 * Get subcategory by slugs
 * @param {string} categorySlug
 * @param {string} subCategorySlug
 * @returns {object|null}
 */
export const getSubCategoryBySlugs = (categorySlug, subCategorySlug) => {
  const category = getCategoryBySlug(categorySlug);
  if (!category) return null;
  return category.subcategories.find((sub) => sub.slug === subCategorySlug) || null;
};

