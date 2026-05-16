declare module '@met4citizen/talkinghead/modules/lipsync-en.mjs' {
  export class LipsyncEn {
    preProcessText(s: string): string;
    wordsToVisemes(w: string): {
      words: string;
      visemes: string[];
      times: number[];
      durations: number[];
      i: number;
    };
  }
}
