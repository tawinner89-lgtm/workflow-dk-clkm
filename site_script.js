ï»¿const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  siteNav.addEventListener("click", (event) => {
    if (event.target.tagName === "A") {
      siteNav.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
}

const notice = document.querySelector("#form-notice");

if (notice) {
  const params = new URLSearchParams(window.location.search);
  if (params.get("sent") === "1") {
    notice.textContent = "Merci, votre demande a bien Ã©tÃ© envoyÃ©e. Nous vous recontactons rapidement.";
    notice.hidden = false;
    const url = new URL(window.location.href);
    url.searchParams.delete("sent");
    window.history.replaceState({}, "", url.pathname + url.search);
  }
}

const hero = document.querySelector(".hero");
if (hero) {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const slides = [
    "https://images.pexels.com/photos/6316054/pexels-photo-6316054.jpeg?cs=srgb&dl=pexels-heyho-6316054.jpg&fm=jpg", // chambre
    "https://cdn.pixabay.com/photo/2022/01/15/22/47/living-room-6940895_1280.jpg", // salon
    "https://images.pexels.com/photos/18495294/pexels-photo-18495294.jpeg?cs=srgb&dl=pexels-soulkidphotography-18495294.jpg&fm=jpg", // bureau
    "https://images.pexels.com/photos/29631732/pexels-photo-29631732.jpeg?cs=srgb&dl=pexels-minasenishino-29631732.jpg&fm=jpg" // espace de travail
  ];

  if (!prefersReduced && slides.length > 1) {
    let index = 0;
    setInterval(() => {
      index = (index + 1) % slides.length;
      hero.style.setProperty("--hero-image", `url('${slides[index]}')`);
    }, 7000);
  }
}

const chatbotToggle = document.querySelector(".chatbot-toggle");
const chatbotPanel = document.querySelector("#chatbot-panel");
const chatbotClose = document.querySelector(".chatbot-close");
const chatbotForm = document.querySelector("#chatbot-form");
const chatbotInput = document.querySelector("#chatbot-input");
const chatbotMessages = document.querySelector("#chatbot-messages");

const faqPairs = [
  { q: ["prix", "tarif", "coÃ»t", "cout", "service"], a: "Le prix de nos services dÃ©pendra de plusieurs critÃ¨res comme le type de service (installation, rÃ©paration ou entretien) et la puissance de votre climatiseur .N'hÃ©sitez pas Ã  demander un devis gratuit." },
  { q: ["dÃ©lai", "delai", "prestation", "temps"], a: "Le dÃ©lai dÃ©pendra du type de service choisi, si c'est urgent vous pouvez demander notre service d'urgence disponible 7j/7 via WhatsApp : 0612-54-00-85." },
  { q: ["services", "proposez", "proposer"], a: "Chez DK CLIM, nous avons 3 services : installation, rÃ©paration et entretien. Pour plus d'informations, n'hÃ©sitez pas Ã  demander un devis gratuit." },
  { q: ["installation", "installer", "pose"], a: "Installation complÃ¨te (Ã©tude, dimensionnement, pose et mise en service). DÃ©lai moyen : 1 Ã  2 semaines aprÃ¨s devis validÃ©." },
  { q: ["entretien", "maintenance", "contrat"], a: "Oui, nous proposons des contrats d'entretien annuels ou des interventions ponctuelles." },
  { q: ["dÃ©pannage", "depannage", "panne", "urgence"], a: "DÃ©pannage rapide 6j/7. Contactez-nous pour une intervention prioritaire." },
  { q: ["zone", "casablanca", "intervention"], a: "Nous intervenons Ã  Casablanca et aux alentours." },
  { q: ["horaires", "heure", "ouverture"], a: "Horaires : LunâSam 9h00â19h00. Urgences : 7j/7." },
  { q: ["pompe", "pac", "air/air"], a: "Nous installons et entretenons les pompes Ã  chaleur air/air." },
  { q: ["marques", "matÃ©riel", "materiel"], a: "Nous travaillons avec des marques reconnues pour leur fiabilitÃ© et performance." },
  q: ["Adresse", "localisation", "showroom"], a: "Notre adresse : Imm 10 M5 Abraj Azhar Farah Essalm - Oulfa - Casablanca (Voir localisation)" },
  { q: ["contact", "email", "mail"], a: "Vous pouvez nous Ã©crire Ã  dkclimatisation@gmail.com ou appeler le 0612-54-00-85." },
  { q: ["devis", "estimation", "devis gratuit"], a: "Pour un devis gratuit , merci de nous Ã©crire Ã  dkclimatisation@gmail.com ou appeler le 0612-54-00-85." }
];

function addBubble(text, type) {
  if (!chatbotMessages) return;
  const div = document.createElement("div");
  div.className = `chatbot-bubble ${type}`;
  div.textContent = text;
  chatbotMessages.appendChild(div);
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

function findAnswer(message) {
  const lower = message.toLowerCase();
  for (const item of faqPairs) {
    if (item.q.some((key) => lower.includes(key))) {
      return item.a;
    }
  }
  return "Pour toute demande spÃ©cifique . Vous pouvez appeler ou nous Ã©crire par wathsapp au 0612-54-00-85 pour une rÃ©ponse rapide.";
}

if (chatbotToggle && chatbotPanel) {
  chatbotToggle.addEventListener("click", () => {
    const isOpen = chatbotPanel.hasAttribute("hidden");
    chatbotPanel.toggleAttribute("hidden");
    chatbotToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

if (chatbotClose && chatbotPanel && chatbotToggle) {
  chatbotClose.addEventListener("click", () => {
    chatbotPanel.setAttribute("hidden", "");
    chatbotToggle.setAttribute("aria-expanded", "false");
  });
}

if (chatbotForm && chatbotInput) {
  chatbotForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = chatbotInput.value.trim();
    if (!value) return;
    addBubble(value, "user");
    chatbotInput.value = "";
    const reply = findAnswer(value);
    setTimeout(() => addBubble(reply, "bot"), 250);
  });
}

const quoteForm = document.querySelector("#quote-form");
if (quoteForm) {
  quoteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(quoteForm);
    const name = data.get("name");
    const phone = data.get("phone");
    const service = data.get("service");
    const location = data.get("location");
    const text =
      `Bonjour DK Climatisation,%0A` +
      `Je souhaite un devis rapide pour ${service}.%0A` +
      `Nom: ${name}%0A` +
      `TÃ©lÃ©phone: ${phone}%0A` +
      `Ville/Quartier: ${location}%0A` +
      `Merci de me recontacter.`;
    const url = `https://wa.me/212612540085?text=${text}`;
    window.open(url, "_blank");
  });
}

const contactForm = document.querySelector("#contact-form");
const contactWaBtn = document.querySelector("#contact-wa-btn");
if (contactForm && contactWaBtn) {
  contactWaBtn.addEventListener("click", () => {
    if (typeof contactForm.reportValidity === "function" && !contactForm.reportValidity()) {
      return;
    }
    const data = new FormData(contactForm);
    const name = data.get("name");
    const phone = data.get("phone");
    const email = data.get("email");
    const message = data.get("message");
    const text =
      `Bonjour DK Climatisation,%0A` +
      `Nouvelle demande depuis le formulaire contact.%0A` +
      `Nom: ${name}%0A` +
      `TÃ©lÃ©phone: ${phone}%0A` +
      `Email: ${email}%0A` +
      `Message: ${message}`;
    const url = `https://wa.me/212612540085?text=${text}`;
    window.open(url, "_blank");
  });
}

const mapIframe = document.querySelector(".map-card iframe");
if (mapIframe && "IntersectionObserver" in window) {
  const mapObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const src = mapIframe.getAttribute("data-src");
          if (src) {
            mapIframe.setAttribute("src", src);
            mapIframe.removeAttribute("data-src");
          }
          observer.disconnect();
        }
      });
    },
    { rootMargin: "200px" }
  );
  mapObserver.observe(mapIframe);
}

const realisationsFrame = document.querySelector("#realisations-frame");
const realisationsTitle = document.querySelector("#realisations-title");
const realisationsDesc = document.querySelector("#realisations-desc");
const realisationsDots = document.querySelector("#realisations-dots");

const realisationsSlides = [
  {
    img: "https://images.pexels.com/photos/19059039/pexels-photo-19059039.jpeg?auto=compress&cs=tinysrgb&w=1200",
    title: "Chambre confortable",
    desc: "Climatisation silencieuse pour un sommeil optimal."
  },
  {
    img: "https://images.pexels.com/photos/5991563/pexels-photo-5991563.jpeg?auto=compress&cs=tinysrgb&w=1200",
    title: "Chambre moderne",
    desc: "TempÃ©rature stable et air sain."
  },
  {
    img: "https://cdn.pixabay.com/photo/2022/01/15/22/47/living-room-6940895_1280.jpg",
    title: "Salon cosy",
    desc: "Confort thermique et design soignÃ©."
  },
  {
    img: "https://images.unsplash.com/photo-BsHycOlU6Bg?auto=format&fit=crop&w=1200&q=80",
    title: "Salon lumineux",
    desc: "Climatisation discrÃ¨te et Ã©lÃ©gante."
  },
  {
    img: "https://images.pexels.com/photos/18495294/pexels-photo-18495294.jpeg?auto=compress&cs=tinysrgb&w=1200",
    title: "Bureau professionnel",
    desc: "Performance et discrÃ©tion au quotidien."
  },
  {
    img: "https://images.pexels.com/photos/29631732/pexels-photo-29631732.jpeg?auto=compress&cs=tinysrgb&w=1200",
    title: "Espace de travail",
    desc: "QualitÃ© d'air et confort durable."
  }
];

function setRealisationsSlide(index) {
  const slide = realisationsSlides[index];
  if (!slide || !realisationsFrame) return;
  const img = new Image();
  img.onload = () => {
    realisationsFrame.style.backgroundImage = `url('${slide.img}')`;
    if (realisationsTitle) realisationsTitle.textContent = slide.title;
    if (realisationsDesc) realisationsDesc.textContent = slide.desc;
  };
  img.onerror = () => {
    if (realisationsTitle) realisationsTitle.textContent = slide.title;
    if (realisationsDesc) realisationsDesc.textContent = slide.desc;
  };
  img.src = slide.img;
  if (realisationsDots) {
    realisationsDots.querySelectorAll("button").forEach((btn, i) => {
      btn.classList.toggle("active", i === index);
    });
  }
}

if (realisationsFrame) {
  let current = 0;
  if (realisationsDots) {
    realisationsSlides.forEach((_, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", `Slide ${i + 1}`);
      btn.addEventListener("click", () => {
        current = i;
        setRealisationsSlide(current);
      });
      realisationsDots.appendChild(btn);
    });
  }

  setRealisationsSlide(current);

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!prefersReduced && realisationsSlides.length > 1) {
    setInterval(() => {
      current = (current + 1) % realisationsSlides.length;
      setRealisationsSlide(current);
    }, 4000);
  }
}

// Contact slider removed

