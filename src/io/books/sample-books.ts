import type { Book } from "./book-types";

export const SAMPLE_BOOKS: Book[] = [
  {
    id: "sample-little-prince",
    title: "The Little Prince",
    author: "Antoine de Saint-Exupéry",
    coverColor: "var(--color-accent)",
    chapters: [
      {
        id: "ch-1",
        title: "Chapter I: The Boa Constrictor",
        text: `Once when I was six years old I saw a magnificent picture in a book called True Stories from Nature about the primeval forest. It was a picture of a boa constrictor in the act of swallowing an animal. Here is a copy of the drawing.

In the book it said: "Boa constrictors swallow their prey whole, without chewing it. After that they are not able to move, and they sleep through the six months that they need for digestion."

I pondered deeply, then, over the adventures of the jungle. And after some work with a coloured pencil I succeeded in making my first drawing. My Drawing Number One. It looked something like this: I showed my masterpiece to the grown-ups, and asked them whether the drawing frightened them.

But they answered: "Frighten? Why should any one be frightened by a hat?" My drawing was not a picture of a hat. It was a picture of a boa constrictor digesting an elephant. But since the grown-ups were not able to understand it, I made another drawing: I drew the inside of a boa constrictor, so that the grown-ups could see it clearly. They always need to have things explained.`,
        wordCount: 204,
      },
      {
        id: "ch-2",
        title: "Chapter II: In the Sahara",
        text: `So I lived my life alone, without anyone that I could really talk to, until I had an accident with my plane in the Desert of Sahara, six years ago. Something was broken in my engine. And as I had with me neither a mechanic nor any passengers, I set myself to attempt the difficult repairs all alone. It was a question of life or death for me: I had scarcely enough drinking water to last a week.

The first night, then, I went to sleep on the sand, a thousand miles from any human habitation. I was more isolated than a shipwrecked sailor on a raft in the middle of the ocean. Thus you can imagine my amazement, at sunrise, when an odd little voice awakened me. It said:

"If you please—draw me a sheep!"

"What!"

"Draw me a sheep!"

I leaped to my feet as if I had been struck by lightning. I rubbed my eyes hard. I looked around me. And I saw a most extraordinary small person, who stood there examining me with great seriousness.`,
        wordCount: 188,
      },
      {
        id: "ch-3",
        title: "Chapter III: The Planet",
        text: `It took me a long time to understand where he came from. The little prince, who asked me so many questions, never seemed to hear the ones I asked him. It was from words dropped by chance that, little by little, everything was revealed to me.

The first time he saw my airplane he asked me: "What is that object?"

"That is not an object. It flies. It is an airplane. It is my airplane."

And I was proud to have him learn that I could fly. He cried out: "What! You have dropped from the sky?"

"Yes," I answered modestly.

"Oh! That is funny!" And the little prince broke into a lovely peal of laughter, which irritated me very much. I like my misfortunes to be taken seriously. Then he added: "So you, too, come from the sky! Which is your planet?"

At that moment I caught a gleam of light in the mystery of his presence; and I demanded, abruptly: "Do you come from another planet?" But he did not reply. He tossed his head gently, looking at my airplane: "It is true that on that you couldn't have come from very far."`,
        wordCount: 198,
      },
    ],
    currentChapterIndex: 0,
    currentParagraphIndex: 0,
    completedChapters: [],
    createdAt: 1700000000000,
    lastReadAt: 1700000000000,
  },
  {
    id: "sample-art-of-war",
    title: "The Art of War",
    author: "Sun Tzu",
    coverColor: "var(--color-primary)",
    chapters: [
      {
        id: "ch-1",
        title: "Chapter I: Laying Plans",
        text: `Sun Tzu said: The art of war is of vital importance to the State. It is a matter of life and death, a road either to safety or to ruin. Hence it is a subject of inquiry which can on no account be neglected.

The art of war, then, is governed by five constant factors, to be taken into account in one's deliberations, when seeking to determine the conditions obtaining in the field. These are: The Moral Law; Heaven; Earth; The Commander; Method and discipline.

The Moral Law causes the people to be in complete accord with their ruler, so that they will follow him regardless of their lives, undismayed by any danger. Heaven signifies night and day, cold and heat, times and seasons. Earth comprises distances, great and small; danger and security; open ground and narrow passes; the chances of life and death. The Commander stands for the virtues of wisdom, sincerely, benevolence, strictness. By Method and discipline are to be understood the marshaling of the army in its proper subdivisions, the graduations of rank among the officers, the maintenance of roads by which supplies may reach the army, and the control of military expenditure.`,
        wordCount: 194,
      },
      {
        id: "ch-2",
        title: "Chapter II: Waging War",
        text: `Sun Tzu said: In the operations of war, where there are in the field a thousand swift chariots, as many heavy chariots, and a hundred thousand mail-clad soldiers, with provisions enough to carry them a thousand li, the expenditure at home and at the front, including entertainment of guests, small items such as glue and paint, and sums spent on chariots and armor, will reach the total of a thousand ounces of silver per day. Such is the cost of raising an army of 100,000 men.

When you engage in actual fighting, if victory is long in coming, then men's weapons will grow dull and their ardor will be damped. If you lay siege to a town, you will exhaust your strength. Again, if the campaign is protracted, the resources of the State will not be equal to the strain.

Now, when your weapons are dulled, your ardor damped, your strength exhausted and your treasure spent, other chieftains will spring up to take advantage of your extremity. Then no man, however wise, will be able to avert the consequences that must ensue. Thus, though we have heard of stupid haste in war, cleverness has never been seen associated with long delays.`,
        wordCount: 202,
      },
    ],
    currentChapterIndex: 0,
    currentParagraphIndex: 0,
    completedChapters: [],
    createdAt: 1700000001000,
    lastReadAt: 1700000001000,
  },
];
