/**
 * Sample lessons for the seed catalog (scripts/db-seed.ts): four per course, in order.
 * [title, summary, minutes]. Lesson content arrives with the lesson player (FE-STU-03).
 */
export type LessonSeed = [title: string, summary: string, minutes: number];

export const LESSONS: Record<string, LessonSeed[]> = {
  "counting-to-100": [
    ["Counting in ones", "Count objects up to 20 and say the number that comes next.", 10],
    ["Tens and ones", "Group objects in tens to count bigger amounts quickly.", 12],
    ["The hundred square", "Find patterns in rows and columns of numbers to 100.", 12],
    ["Counting in twos, fives and tens", "Skip count forwards and backwards to 100.", 10],
  ],
  "phonics-first-sounds": [
    ["Letter sounds s, a, t, p", "Hear, say and write the first four letter sounds.", 10],
    ["Blending sounds into words", "Push sounds together to read words like sat and pat.", 12],
    ["Digraphs: sh, ch and th", "Two letters, one sound: read words like ship, chip and thin.", 12],
    ["Tricky words", "Learn words like the, to and I that don't follow the rules.", 10],
  ],
  "living-things-around-us": [
    ["Alive or not alive?", "Sort things into living, once living and never alive.", 10],
    ["What animals need", "Food, water, shelter and air: what every animal needs to survive.", 12],
    ["What plants need", "Light, water and warmth: grow a bean and watch what happens.", 15],
    ["Habitats near you", "Explore a garden or park and find who lives there.", 15],
  ],
  "adding-and-subtracting-within-20": [
    ["Number bonds to 10", "Find every pair of numbers that makes 10.", 10],
    ["Adding by counting on", "Start with the bigger number and count on to add.", 10],
    ["Subtraction as taking away", "Take away objects and count what is left.", 10],
    ["Word problems within 20", "Read a short story problem and choose add or subtract.", 15],
  ],
  "my-first-stories": [
    ["Beginning, middle and end", "Every story has three parts: spot them in a story you know.", 12],
    ["Making characters", "Invent a character and describe how they look and feel.", 12],
    ["Planning my story", "Draw and label a story map before writing.", 15],
    ["Writing and sharing", "Write your story in full sentences and read it aloud.", 20],
  ],
  "maps-of-my-town": [
    ["What is a map?", "A map shows a place from above: compare a photo and a map.", 10],
    ["Using a map key", "Symbols stand for real things: find a park, a school and a river.", 12],
    ["Left, right, forwards, back", "Give and follow directions on a simple map.", 12],
    ["Draw a map of your street", "Make your own map with a key.", 20],
  ],
  "multiplication-facts": [
    ["Multiplication as equal groups", "See 3 × 4 as three groups of four, and as an array.", 12],
    ["The 2, 5 and 10 times tables", "Spot the patterns that make these tables easy.", 12],
    ["The 3, 4 and 8 times tables", "Use doubling to learn the 4 and 8 times tables.", 15],
    ["Quick recall games", "Practise all the tables to 10 × 10 against the clock.", 10],
  ],
  "plants-and-how-they-grow": [
    ["Parts of a plant", "Roots, stem, leaves and flowers: what does each part do?", 12],
    ["From seed to plant", "Follow the life cycle of a sunflower.", 12],
    ["How water travels in a plant", "An experiment with celery and coloured water.", 20],
    ["Pollination", "How bees and the wind help plants make seeds.", 12],
  ],
  "fractions-made-simple": [
    ["What is a fraction?", "A fraction is part of a whole: halves, thirds and quarters of shapes and numbers.", 12],
    ["Equivalent fractions", "Why one half is the same as two quarters, with fraction walls.", 15],
    ["Comparing fractions", "The more equal parts, the smaller each part: compare and order fractions.", 15],
    ["Adding and subtracting fractions", "Add and subtract fractions with the same denominator, on a number line.", 15],
  ],
  "ancient-egypt": [
    ["Life along the Nile", "Why the river mattered for farming, travel and trade.", 12],
    ["Pharaohs and pyramids", "Who the pharaohs were and how the pyramids were built.", 15],
    ["Hieroglyphs", "How Egyptians wrote, and write your name in hieroglyphs.", 15],
    ["Mummies and the afterlife", "What Egyptians believed about life after death.", 12],
  ],
  "coding-with-blocks": [
    ["Sequences", "Put instructions in the right order to move a sprite.", 12],
    ["Loops", "Repeat instructions without writing them again.", 12],
    ["Events", "Make things happen when a key is pressed or a sprite is clicked.", 15],
    ["Build a simple game", "Combine sequences, loops and events into a catch game.", 25],
  ],
  "decimals-and-percentages": [
    ["Tenths and hundredths", "Place value after the decimal point.", 12],
    ["Thousandths and rounding", "Read, write and round decimals with three places.", 15],
    ["Fractions, decimals and percentages", "One amount, three ways to write it.", 15],
    ["Percentages of amounts", "Find 10%, 25% and 50% of a number.", 15],
  ],
  "the-water-cycle": [
    ["Evaporation", "How the sun turns water into water vapour.", 12],
    ["Condensation", "Why a cold glass gets wet on the outside.", 12],
    ["Precipitation", "Rain, snow and hail: how water comes back down.", 10],
    ["Make a water cycle in a bag", "An experiment you can do at home.", 20],
  ],
  "persuasive-writing": [
    ["Opinions and reasons", "Say what you think and give reasons for it.", 12],
    ["Using evidence", "Facts, examples and quotes that make an argument stronger.", 15],
    ["Persuasive language", "Questions, repetition and powerful words.", 12],
    ["A strong ending", "Finish with a call to action your reader remembers.", 12],
  ],
  "ratios-and-rates": [
    ["Ratio language", "Compare quantities: 3 to 2, 3:2 and three for every two.", 12],
    ["Equivalent ratios", "Scale a recipe up and down with ratio tables.", 15],
    ["Unit rates", "Price per item and speed: which is the better deal?", 15],
    ["Solving ratio problems", "Use tables and double number lines for real problems.", 20],
  ],
  "cells-the-building-blocks-of-life": [
    ["What is a cell?", "All living things are made of cells.", 10],
    ["Using a microscope", "Prepare a slide and look at onion cells.", 20],
    ["Plant and animal cells", "Nucleus, membrane, cell wall and chloroplasts: compare them.", 15],
    ["Specialised cells", "Why nerve, muscle and root hair cells look different.", 12],
  ],
  "spanish-for-beginners": [
    ["Greetings", "Hola, buenos días and adiós: say hello and goodbye.", 10],
    ["Numbers 1 to 20", "Count and say your age in Spanish.", 12],
    ["My family", "Talk about your family members.", 12],
    ["Everyday phrases", "Please, thank you and asking for things.", 10],
  ],
  "pre-algebra": [
    ["Expressions and variables", "Use letters to stand for numbers.", 12],
    ["Simplifying expressions", "Collect like terms and use the distributive property.", 15],
    ["One-step and two-step equations", "Solve equations by doing the same to both sides.", 15],
    ["Inequalities", "Solve and graph inequalities on a number line.", 15],
  ],
  "world-climates": [
    ["Weather and climate", "What's the difference, and how is climate measured?", 12],
    ["Climate zones", "Tropical, dry, temperate, cold and polar climates.", 15],
    ["What shapes a climate", "Latitude, altitude, oceans and winds.", 15],
    ["Living in different climates", "How homes, food and farming change with the climate.", 15],
  ],
  "introduction-to-python": [
    ["Variables and types", "Store numbers and text, and print them.", 15],
    ["Conditions", "Make decisions with if, elif and else.", 15],
    ["Loops", "Repeat code with for and while.", 15],
    ["Functions", "Write reusable code with parameters and return values.", 20],
  ],
  "chemistry-basics": [
    ["Atoms and elements", "What everything is made of.", 12],
    ["The periodic table", "How elements are arranged, and why.", 15],
    ["Compounds and mixtures", "Join elements together, then separate mixtures.", 15],
    ["Chemical reactions", "Signs of a reaction, and balancing simple equations.", 15],
  ],
  "algebra-1": [
    ["Linear equations", "Solve equations with variables on both sides.", 15],
    ["Functions and graphs", "Slope, intercepts and graphing straight lines.", 20],
    ["Systems of equations", "Solve two equations at once, by graphing and by elimination.", 20],
    ["Introduction to quadratics", "Parabolas, and solving by factoring.", 20],
  ],
  "the-industrial-revolution": [
    ["Machines and factories", "How steam power changed how things were made.", 15],
    ["Growing cities", "People moved from farms to towns: what was life like?", 15],
    ["Workers and children", "Working conditions, and the first laws to protect children.", 15],
    ["Railways and canals", "How transport connected the country.", 12],
  ],
  "geometry": [
    ["Proof and reasoning", "Write a two-column proof.", 20],
    ["Congruent triangles", "SSS, SAS, ASA and when triangles are the same.", 20],
    ["Similarity", "Scale factors and similar shapes.", 15],
    ["Circles", "Arcs, chords, tangents and inscribed angles.", 20],
  ],
  "biology-genetics": [
    ["DNA and genes", "How instructions for living things are stored.", 15],
    ["Inheritance", "Dominant and recessive traits, with Punnett squares.", 20],
    ["Variation", "Why offspring differ from their parents and from each other.", 15],
    ["Mutations", "What changes in DNA can do.", 15],
  ],
  "drawing-from-observation": [
    ["Line and contour", "Draw what you see, not what you think you see.", 20],
    ["Tone and shading", "Light, shadow and the illusion of form.", 20],
    ["Proportion", "Measure with your pencil to get shapes right.", 20],
    ["Perspective", "One-point and two-point perspective.", 25],
  ],
  "precalculus": [
    ["Functions and their inverses", "Domain, range and composition of functions.", 20],
    ["Trigonometric functions", "Sine, cosine and tangent on the unit circle.", 20],
    ["Sequences and series", "Arithmetic and geometric sequences and their sums.", 20],
    ["Limits", "What happens as x gets closer and closer to a value.", 20],
  ],
  "data-structures-and-algorithms": [
    ["Lists and arrays", "Store and access collections of data.", 20],
    ["Trees", "Hierarchies, and binary search trees.", 25],
    ["Searching", "Linear search and binary search compared.", 20],
    ["Sorting", "Bubble sort, merge sort, and how to reason about speed.", 25],
  ],
  "calculus": [
    ["Derivatives", "The slope of a curve at a point, from first principles.", 25],
    ["Rules of differentiation", "Power, product, quotient and chain rules.", 25],
    ["Integrals", "Area under a curve, and antiderivatives.", 25],
    ["Applications", "Optimisation and rates of change in real problems.", 25],
  ],
  "physics-mechanics": [
    ["Motion", "Displacement, velocity and acceleration.", 20],
    ["Forces and Newton's laws", "Why things move the way they do.", 25],
    ["Energy", "Kinetic and potential energy, and work.", 20],
    ["Momentum", "Collisions and conservation of momentum.", 20],
  ],
};

export function lessonSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
