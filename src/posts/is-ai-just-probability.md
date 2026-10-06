---
title: "Is AI “just” probability?"
date: 2026-09-23
description: "A look at what scientific research has to say about this common claim."
medium: c2f1157ffb55
---

This time last year, if you’d asked me about AI, I’d have responded with a popular refrain:

“It’s just probability.”

This was rarely offered as a neutral description. It often came with an eye roll and the assumption that whoever I was talking to had been tricked somehow by AI hype and marketing.

Most commonly, it was deployed to win arguments:

“It’s just probability, so it can’t actually do math.”

“It’s just probability, so current methods will never get us to Artificial General Intelligence.”

“It’s just probability, so it can never discover something new.”

“It’s just probability, so whatever it looks like it’s doing, it isn’t ***really*** doing that.”

This remains a popular stance, especially among more technically savvy people, and the fact that so many technically savvy people tend to say it also gives it credibility.

The appeal is obvious. It’s comforting to believe that AI is just a very large version of something simple we already understand.

But… is it?

Is “just probability” an accurate account of how these systems work, or an oversimplification that leads to incorrect conclusions about what the technology is and can do?

As AI got observably more powerful, I got more curious. Eventually, I decided I needed a deeper understanding.

Confidently, I told myself: I’m a software developer and AI is just software. Most of the technology is laid out in openly published research. I just had to go read it.

So I went and read about how to set up the standard AI architecture from scratch. But that didn’t really explain how it worked.

Then I read as much as I could about [the historical discoveries that got us to this point](/blog/a-quick-history-of-ai) and how the intuitive leaps were made. That didn’t really explain how it worked either.

It turns out, we don’t yet fully understand how it works; however, there are a lot of researchers out there trying to figure it out. As you can imagine, the funding is flowing. This research, too, is mostly free to read online.

And answers are being found. Fascinating ones. But to explain them, I will need to establish a little background.

## How AI Works

AI works by manipulating what are known as “tokens.” Tokens can represent words, symbols, letters, fractions of words, or commands, but it is easiest to conceptualize if you think of them as words.

Every AI system has a fixed vocabulary of words/tokens. OpenAI’s ChatGPT, for example, uses a vocabulary of about 200,000 tokens. As it generates text, the next word/token must be chosen from its 200,000 token vocabulary. AI makes this choice by generating a probability distribution across all 200,000 tokens in its vocabulary and then uses that probability distribution to decide what word/token it should select next.

Let’s outline a simple example for illustration.

Say you ask: “What is the capital of France?”

AI processes the input and outputs a probability for each of the 200,000 possible next words. “The” gets the highest score, with “Paris” close behind. Meanwhile, most of the 200,000 tokens receive a value that is basically 0%.

![](/blog-images/is-ai-just-probability/1FahukXmA9PM5MahnVGVSuw.png)

Based on this probability distribution, the system chooses “The” as the next word, then feeds the original question and the newly minted first word of its answer back through the network. This time, the highest probability is given to “capital” which is then added to the input and fed back through the system.

![](/blog-images/is-ai-just-probability/1qPYS0jFdRbxneQHjQNoS3g.png)

Repeat this process, generating a probability distribution one word at a time, until you have generated the full response: “The capital of France is Paris.”

After selecting a period (“.”), the next probability distribution is heavily weighted towards the token that marks the answer complete. Once that token is selected, the system sends the response back to the user.

This level of understanding is roughly where I was a year ago. If you understand AI to this level, a statement like “it’s just probability” makes sense. AI was trained on massive amounts of text and learned to predict the probability that a given word should come next given the words that have come so far. That sounds a lot like an advanced version of the probability we learned in grade school, and it is a reasonable way that the system ***could*** work.

## Now consider a second analogy

Pretend you asked a football fan to go through each team in the NFL and give you a probability for each that they will win the Super Bowl this year. They oblige, excited to show off their expertise, and go through the full list of NFL teams and assign each a probability.

Would you consider what they did to generate that list “just probability”? Probably not.

There is something more here. Your friend has, in his head, an understanding of how the NFL works. He knows facts about teams and players. He knows the rules of the game and the structure of the playoff system. He is aware of recent news about trades and injuries. Even if we don’t understand how all that information is stored in your friend’s brain, clearly this is more than “just probability.”

But on a certain level, the situation is very much the same: in response to a question, your friend gave you a probability distribution over a fixed set of choices. Just like AI does.

## So which analogy is accurate?

To investigate, the natural next step is to look deeper at how AI generates its probability distribution.

Within an AI system, tokens are represented by coordinates. Each token in the vocabulary has a defined position within a mathematical space. Tokens for “Paris” and “France” might be close to each other, while “capital” and “the” are in different places entirely. Here is an example of what that might look like in an AI using a two-dimensional “embedding space” (the embedding spaces of modern AI systems use thousands or tens of thousands of dimensions).

![](/blog-images/is-ai-just-probability/1oXMyMh_H_N87awoN1EeoLg.png)

To generate the next token, AI starts in the location of the last token. Then, based on the full list of input tokens and their position, it applies a series of trained transformations which move it through the embedding space. Once it has completed all of its transformations, the output of the neural network is a new location.

![](/blog-images/is-ai-just-probability/1xo2ZB8q3Bq-WjZL1JSqikQ.png)

However, this new location is unlikely to land directly on the location of a token in the AI’s vocabulary, so a translation layer is needed to get from what the system calculated and ***wants*** to say to an actual word/token it can respond with.

To do this, the system compares the final location output by the neural network to the location of each token in its vocabulary, producing a score for each. Those scores are then compared to each other to generate relative probabilities.

![](/blog-images/is-ai-just-probability/1tCfWcgCOk9hNzzJ4AzXXkg.png)

Thus, the probability distribution is really a translation layer bolted onto the end of the AI’s neural network, not the mechanism by which it works internally.

## But what is happening internally?

While we know how to build and train a neural network and what happens mechanically when they run, we don’t fully understand how they are actually storing or processing information. So we have to make hypotheses and test them. Early on, the “just probability” question was a validly debated and heavily researched one.

Some argued that because a probability distribution is the end result that we train the network to produce, what we are really building is a very sophisticated statistical model of the training text. In this view, the network learns which words tend to follow which in what situations and nothing more: “just probability.”

This camp predicted limits to what these systems would be able to do. They based these expectations on their intuitive understanding of traditional statistics, and confidently declared current AI technology an eventual dead end.

Others believed AI was capable of working more like the football fan. After all, the basic structure of AI was inspired by structures in our own brains, so it is reasonable to assume it might store information in a similar way.

According to this camp, an AI could learn about football and the NFL and individual players, build an internal picture of how it all fits together, and reason from that “world model” to produce its answer. In this view, AI is capable of more than modeling text relationships. It can also model the things the text represents: not ***just*** probability.

Research has mostly settled this particular debate in favor of the latter.

## Let’s look at how

One of the most commonly cited examples comes from a small experiment. Researchers trained an AI on nothing but transcripts of Othello games. They gave it long lists of moves like “E3, D3, C4…” but gave it no explanation of the rules or what the letter/number combinations meant. When the AI was good at predicting legal next moves, the researchers began to study what was going on inside.

By mapping the behavior of the artificial neural network in response to prompts, they were able to identify where and how it represented the state of each spot on the board. When they reached in and edited that internal board model (flipping a piece from black to white mid process), the AI’s selected next move matched the edited board-state, not the input game history. The AI was predicting moves by building a world model to represent the state of the game, not by tracking probability relationships between strings in an array.

![](/blog-images/is-ai-just-probability/1ZB-TB8qOBAKxTvNVTMrHDA.png)

Once researchers knew how to look for them, they found that world models also show up in more complex AI systems like modern chatbots.

For example, researchers were able to identify a “Golden Gate Bridge” pattern that lights up whether the bridge is mentioned in English, in Japanese, or shown in a picture. Again, further verification came from editing the network as it ran. If they amplified the identified pattern during an unrelated prompt, the AI would find a way to work the famous bridge into its response in whatever language it was speaking.

This backs up the idea that AI is capable of modeling not just surface word relationships but, at least on some level, the things the words are actually about. The world models are not always complete or accurate, but neither are those of the football fan. Even a flawed model of the world is still a model of the world, and that’s more than “just probability” allows for.

Importantly, these are not isolated results. The research along this line of inquiry is extensive and well replicated. Evidence of internal world models has been found by different labs, in different AI systems, and on many different tasks. The strongest results are confirmed the same way: by predicting where the neural network is storing its world model, editing the internal representation, and watching the answer change as a result.

## It’s not “just world models” either

World models are interesting and one of the most vivid examples, but they are not the only line of research which has shown capabilities beyond probabilistic lookup.

Research also found that when answering a multi-step question, such as “What is the capital of the state containing Dallas?”, the network activates an intermediate “Texas” concept before arriving at “Austin.” This is a chain of reasoning, not just a lookup.

Similarly, when writing rhyming poetry, AI has been shown to choose the rhyme word for the end of a line before it writes the first word of that line, planning ahead in a way a purely one-word-at-a-time predictor should not be able to do.

Reverse engineering of trained AI systems has shown that they can independently discover algorithms to solve problems. For example, an AI trained to do modular addition worked out a method based on trigonometric functions — something it was never shown.

AI can also learn patterns that exist only within the current prompt. If I tell an AI my name is Matt Dinkel (tokens: “Matt” “Din” “k” “el”), then the next time “Din” appears, the system will confidently predict “k” as the next token — even if that sequence never appeared in its training data. The mechanism behind this is a small circuit within the neural network (now known as an “induction head”) that looks back over the prompt for an earlier occurrence of the current token and copies what followed it. It isn’t something we ever explicitly designed, but the pattern has been found in almost every AI system researchers have examined.

Some AI systems have also shown an understanding of the limits of their own knowledge. Researchers have found that when asked to rate their confidence in their ability to answer a question, in many cases the AI’s stated confidence level correlated with its actual measured accuracy at answering that question. An AI that can report accurately about its own uncertainty is tracking something about itself, not just the text it was trained on.

Perhaps the most on-the-nose finding is what is called “grokking.” If you train a small AI on arithmetic, it first memorizes the training examples and struggles to solve problems it has not seen, exactly like the “just probability” camp predicted. Then, long after, it abruptly starts solving the untrained problems.

![](/blog-images/is-ai-just-probability/1I2ZZyaz078VQ0kd-vnxJ1w.png)

If you inspect what is happening internally in the neural network as you train it, you can watch it slowly develop the algorithm. Then, as the accuracy in unseen problems spikes, it suddenly removes the memorization lookup circuits. The behavior “just probability” predicts is correct, until it isn’t.

And the list goes on.

## But who cares?

“Just probability” isn’t only a description. It’s a premise people reason from, and the conclusions they reach are often incorrect.

Calling AI “just probability” is true in the same way that calling humans “just chemistry” is true. Both statements are technically accurate, but at a level that explains very little. Chemistry alone can hardly be used to make sense of how people make decisions, and it is downright useless when it comes to understanding, for example, how a human predicts football outcomes.

Take the claim: “…which is why AI will never be good at math.”

If AI were only tracking which digits tend to follow which, that would be a fair prediction. Except AI ***is*** good at math. In 2025, multiple AIs achieved gold-medal performance at the International Mathematical Olympiad. Researchers have also inspected how AIs do math and found them capable of inventing algorithms they were never taught. This would not be possible from simple statistical text analysis.

Or how about: “…so the current technology will never lead to AGI.”

Maybe it won’t. But the argument usually offered for that claim (that next-word prediction is too shallow a task to produce real understanding) doesn’t survive even a passing glance at the current research.

Training neural networks to predict the next word, it turns out, often leads them to internally model the thing the words are about. Whether that scales all the way up to general intelligence is an open question, but the question of whether AI is capable of building and reasoning from internal models of the world is mostly settled.

None of this means AI is conscious, or that it understands things the way we do, or that the marketing hype is justified. Skepticism about AI is healthy. But that skepticism should be informed by the current research into what these systems actually do, or it quickly becomes unjustified, head-in-the-sand dismissal.

## It’s still statistics

Finally, to be clear: what is happening is, pedantically, still statistics. Math is being used to make predictions from large data sets. That is statistics by definition.

AI is, in a way, a new kind of statistics. It is calculated unlike anything we’ve calculated before. It represents a form of statistics that is so complicated we are only just beginning to understand why and how it works. And it is not behaving like any of the statistics we are used to or respecting their traditionally intuitive limits.

It would be pretty silly to call something like that “just statistics.”

## A small selection of sources

- [Grokking (January 2022)](https://arxiv.org/abs/2201.02177)
- [Induction heads (March 2022)](https://transformer-circuits.pub/2022/in-context-learning-and-induction-heads/index.html)
- [AI knows what it knows (July 2022)](https://arxiv.org/abs/2207.05221)
- [Othello example (October 2022)](https://arxiv.org/abs/2210.13382)
- [Untrained invention of trig-based modular addition and internal view of grokking (January 2023)](https://arxiv.org/abs/2301.05217)
- [Golden Gate Bridge example (May 2024)](https://transformer-circuits.pub/2024/scaling-monosemanticity/index.html)
- [Dallas/Texas/Austin example, rhyme planning example, and untrained math algorithm example (March 2025)](https://transformer-circuits.pub/2025/attribution-graphs/biology.html)
- [Google DeepMind gets gold metal at IMO (July 2025)](https://deepmind.google/discover/blog/advanced-version-of-gemini-with-deep-think-officially-achieves-gold-medal-standard-at-the-international-mathematical-olympiad)
