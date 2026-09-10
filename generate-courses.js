import { writeFileSync } from 'fs';

const courseNames = [
    "Algoritmer och datastrukturer", "Artificiell intelligens", "Avancerad webbutveckling",
    "Cloud Computing", "Cybersäkerhet", "Datorarkitektur", "Datorseende",
    "Databasdesign", "Datakommunikation", "Datateknik", "Diskret matematik",
    "Distribuerade system", "Examensarbete", "Flertrådad programmering",
    "Formella metoder", "Funktionell programmering", "Grafalgoritmer",
    "Human-datorinteraktion", "Inbyggda system", "Introduktion till AI",
    "Introduktion till programmering", "IoT och sensornätverk",
    "JavaScript-baserade webbramverk", "Kompilatorkonstruktion",
    "Kryptografi", "Linuxadministration", "Logikprogrammering",
    "Machine Learning", "Maskininlärning och statistik", "Mjukvaruarkitektur",
    "Mjukvarutestning", "Mobil applikationsutveckling", "Nätverk och protokoll",
    "Objektorienterad analys och design", "Objektorienterad programmering",
    "Objektorienterad programmering i Java", "Objektorienterad programmering i Python",
    "Operativsystem", "Parallell programmering", "Programmeringsparadigm",
    "Realtidssystem", "Säker mjukvaruutveckling", "Signalbehandling",
    "Systemarkitektur", "Systemintegration", "Teknisk kommunikation",
    "UX och användbarhet", "Versionshantering och DevOps", "Webbaserade ramverk",
    "Webbutveckling", "Webbteknologier", "Avancerade databaser",
    "Big Data och dataanalys", "DevOps och CI/CD", "Digitala affärsmodeller",
    "Etik i IT", "Geografiska informationssystem", "Grafik och visualisering",
    "Informationsarkitektur", "IT-projektledning", "IT-rätt",
    "Kommunikation och presentationsteknik", "Kvalitetssäkring",
    "Mjukvaruutveckling i grupp", "NoSQL-databaser", "Programutveckling",
    "Responsiv webbutveckling", "REST och API-design", "Spelarkitektur",
    "Spelprogrammering", "Statistik för datavetare", "Säkerhet i distribuerade system",
    "Testautomatisering", "Tillämpad maskininlärning", "Verktyg för systemutveckling",
    "Videokomprimering", "Virtualisering och containers"
];

const programs = [
    { code: "PAGWE", name: "Webbprogrammering" },
    { code: "PAGWG", name: "Software Engineering" },
    { code: "PADAT", name: "Datateknik" },
    { code: "PADAJ", name: "Datavetenskap" },
    { code: "PAMCS", name: "Computer Science" },
    { code: "PAITS", name: "IT-säkerhet" },
    { code: "PAGAM", name: "Spelutveckling" },
];

const responsible = ["efo", "msc", "aro", "per", "ann", "jon", "lin", "kar"];
const terms = [];
for (let year = 2018; year <= 2026; year++) {
    terms.push(`HT${String(year).slice(2)}`);
    terms.push(`VT${String(year).slice(2)}`);
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const courses = [];
const usedCodes = new Set();

for (let i = 0; i < 3000; i++) {
    let code;
    do {
        code = `DV${randInt(1500, 1999)}`;
    } while (usedCodes.has(code));
    usedCodes.add(code);

    const prog = pick(programs);
    const yearSuffix = String(randInt(18, 26)) + "h";
    const isOptional = Math.random() < 0.3;
    const startPeriod = randInt(1, 4);
    const points = pick([7.5, 7.5, 7.5, 15.0]);
    const endPeriod = points === 15.0 ? Math.min(startPeriod + 1, 4) : startPeriod;

    courses.push({
        term: pick(terms),
        courseCode: code,
        courseName: pick(courseNames),
        courseRequestType: isOptional ? "Elective" : "Program",
        points,
        startPeriod: String(startPeriod),
        endPeriod: String(endPeriod),
        educationType: "Normal",
        programmeOccasionCode: `${prog.code}${yearSuffix}`,
        programmeOccasionName: prog.name,
        optionTypeText: isOptional ? "Valbar" : "Obligatorisk",
        optionType: isOptional ? "Optional" : "Required",
        students: randInt(0, 120),
        courseResponsible: pick(responsible),
    });
}

writeFileSync('./courses.json', JSON.stringify(courses, null, 2));
console.log(`Generated ${courses.length} courses → courses.json`);
