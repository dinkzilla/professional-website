---
title: "A Quick History of AI"
date: 2026-08-06
description: "How cognitive scientists, fancy math, video game hardware, and crowdsourcing platforms created modern AI."
medium: 9fcdbe0037c7
---

## Artificial Neural Networks

In the 1950s, scientists had a fairly good understanding of the basic physical structure of our brains.

A brain, they knew, is a dense network of small interconnected units called neurons. Unfortunately, understanding how something is built is not the same as understanding how it works, and there were a lot of competing theories about how our brains actually used neurons to learn and store information.

Experimenting directly on brains is difficult and can raise ethical questions, so Frank Rosenblatt, a psychologist working for Cornell with funding from the US Navy, decided instead to build an artificial neural network and see if he could use it to make a machine learn. If he couldn’t study directly what was happening in our actual brains, he could at least prove his theories feasible by building a working model.

He called his device “The Perceptron.”

The Perceptron was a large, complex machine. Inside, it was designed to model a small neural network, but from the outside, the Perceptron had only three user-facing parts:

1. A camera
2. A simple A/B output
3. A training button to tell it when it was wrong

Rosenblatt showed the camera flashcards of triangles and squares. They were drawn on different parts of the card, at different sizes, and in different orientations. Every time he showed the Perceptron a card, it gave an output: A or B.

Rosenblatt, somewhat arbitrarily, chose A to represent a triangle and B to represent a square. Every time he showed the machine a card, if it was right, he would do nothing and show it the next card. If it was wrong, he would press the training button.

When the training button was pressed, the Perceptron would make loud noises as physical motors inside the machine adjusted various parameters of the artificial neurons. Then Rosenblatt would show it the next card.

Initially, the outputs were random — correct only roughly half the time. But as he continued to correct the machine using his training button, the machine’s accuracy slowly improved.

It was learning.

Ten thousand flashcards later, the machine no longer needed correcting, and Rosenblatt had an almost perfect “triangle or square” detector.

Then, he switched to a new set of flashcards. This one had lines that were either squiggly or straight. Rosenblatt decided that squiggles would be A and straight lines would be B.

Initially, the machine was wrong roughly half the time again. After all, it had been trained to recognize squares and triangles.

But as Rosenblatt corrected it with the training button, motors whirred, readjusting the Perceptron’s internal parameters, and it became slowly more accurate until, eventually, the Perceptron became an accurate “squiggle or straight” detector.

Then Rosenblatt changed flashcards again. This time, the cards had dots that were either on the upper right third (A) or the lower left two-thirds (B). The machine’s motors whirred madly as Rosenblatt again fed it cards and slammed the training button, letting it know the game had changed once again.

Sure enough, thousands of flashcards later, the machine was now a dot location detector.

Rosenblatt built his Perceptron, the first artificial neural network, in the late 50s and publicly demonstrated his completed device in 1960.

At the time, the Perceptron generated sensational headlines which would feel right at home beside AI news stories from 2026. For example, on July 8, 1958, reporting on an early prototype of the Perceptron, [*The New York Times* reported](https://timesmachine.nytimes.com/timesmachine/1958/07/08/83417341.html?pageNumber=25):

> The Navy revealed the embryo of an electronic computer today that it expects will be able to walk, talk, see, write, reproduce itself and be conscious of its existence.

Eventually, the hype met a backlash as other researchers pointed out what the Perceptron could ***not*** do. For example, it could not be trained to recognize “are the lines on this flashcard all connected or not?” no matter how many flashcards you tried to train it on. (For the real nerds: Rosenblatt’s Perceptron could only identify linearly separable categories.)

In 1969, respected researchers Marvin Minsky and Seymour Papert published a book titled *Perceptrons*, in which they rigorously outlined the device’s shortcomings and declared artificial neural network research to be a likely dead end. In the aftermath, funding for artificial neural networks dried up and research stalled for nearly 20 years.

While the criticisms were technically valid, the pessimism they inspired was overblown. The Perceptron’s artificial neural network design was not a dead end, it was simply missing a few pieces. In fact, the conceptual design of Rosenblatt’s neural network underpins the modern AI we use today.

Unfortunately, Rosenblatt died in a boating accident in 1971 and never saw his design vindicated.

## Backpropagation

Even as they skewered the Perceptron, Minsky and Papert acknowledged that its shortcoming could theoretically be overcome if you could layer multiple of Rosenblatt’s simple artificial neural networks together (the way they exist in our brains); however, training a multi-layer neural net is significantly more complicated than training one with only a single layer.

Minsky and Papert (and Rosenblatt for that matter) were at a loss for how to calculate which of the parameters within a multi-layered neural network would need adjusting in response to the training button. In fact, the problem was so dauntingly complicated that Minsky and Papert declared in *Perceptrons* that it was likely impossible.

Paul Werbos, a social scientist and mathematician, was not convinced.

Like Rosenblatt, Werbos was also interested in how real human brains worked and how we might build working models of them. He came across Minsky’s writing during his research and found much of it inspirational, but he disagreed with Minsky’s judgement about the impossibility of training a multi-layer model.

[In an interview in 2022](https://mindmatters.ai/wp-content/uploads/sites/2/2022/04/Mind-Matters-Podcast-Transcript-Episode-184-Paul-Werbos-Bingecast.pdf), Werbos recalled:

> I met Minsky and he said, “Nah, that idea never worked. I couldn’t figure out how to do it. Nobody could figure out how to do it.” And I said, “I can figure out how to do it” because I knew the math, and a lot of these people were sort of like glorified hackers. They were looking at themselves in the mirror at how proud they were, how clever they were, and they didn’t go to the math.

So Werbos decided to do the math. He made it the subject of his Harvard PhD thesis in Mathematics. In support of his thesis, he even conducted independent studies under Minsky. When he was certain he’d solved it, he approached Minsky again:

> I knew his way of thinking, and I walked in and said, “Marvin, you’ve got this great book, but the thing is, the problem can be solved. Here’s how to solve it. Why don’t we become co-authors so that you won’t be embarrassed when it comes out?” …

> That was a great conversation, but the bottom line was Marvin Minsky kind of said, at the end: “This may be true, but if I do this, the modelers will all kill me, and I have to deal with my reputation… All those people who think they know how brains work, who don’t know how brains work, they’ll kill me if I start getting associated with a different way of doing how brains work.”

As a result, when Werbos’s thesis was published in 1974, it went largely unnoticed even though it laid out the algorithm for training multi-layer artificial neural networks. Today, that algorithm is known as “backpropagation.”

While most of the people working on modeling brains and human learning abandoned artificial neural networks in the wake of *Perceptrons*, a small group of underfunded researchers continued to work on them. Eventually, they too did the math and independently discovered backpropagation over a decade after Werbos.

In 1986, they released their findings in a series of articles, books, and demonstrations. This time, the larger community noticed.

## General Purpose GPU Computing

Unfortunately, knowing how to train a multi-layer artificial neural network didn’t make it practical.

There were some commercial success stories, such as LeNet, a neural network trained to read hand written checks submitted at ATMs, which was developed by AT&amp;T and deployed commercially in the 1990s. However, for the most part, artificial neural networks remained a research tool for academics studying cognitive science.

The barrier to practical commercial use was mainly the physical computer hardware available at the time. Artificial neural networks take a lot of computational power to both train and run, and the computers of the day were not up to the task.

Computers are essentially super advanced calculators, and the main calculator on a standard computer, known as the Central Processing Unit or CPU, is built to do a small number of complex calculations at a time. This design targets how most applications on a computer run: as a series of one complex calculation after another.

Neural networks, on the other hand, require massive amounts of simultaneous but simple calculations. For this type of workload, a CPU becomes a bottleneck, and running a neural network on the hardware of the &#39;80s and &#39;90s was just too slow or too expensive for most practical applications.

Luckily, there was another community that was having the same problem: video game developers.

To render graphics from a computer, the color of every pixel must be recalculated multiple times every second. Similar to a artificial neural network, this requires large amounts of simultaneous but simple calculations. Unlike artificial neural networks, however, video games had proven to be very commercially profitable. So, in the pursuit of faster, higher resolution graphics, and supported by the financial success of the video game industry, a different type of processor emerged: the Graphics Processing Unit or GPU.

Instead of a CPU’s sequential complex operations, a GPU was built to do a high volume of simple calculations simultaneously. GPU technology had been developing through the &#39;80s and &#39;90s; however, for a long time they were dedicated devices which could ***only*** process graphical output.

In 2007, Nvidia started releasing GPUs with a feature called CUDA (which stood for Compute Unified Device Architecture). CUDA allowed developers access to the GPU’s calculating capabilities directly so that they could use it to calculate things other than pixel colors.

CUDA-enabled general purpose GPUs finally provided a hardware platform optimized for exactly the type of computational workload an artificial neural network requires.

## Artificial Artificial Intelligence

Now that neural network researchers knew how to build an artificial neural network, how to train it, and what hardware to run it on, they needed the right data to build a truly impressive demonstration.

Think back to Rosenblatt and his flashcards: complex tasks like shape recognition required telling the Perceptron the correct answer to ten thousand unique examples. This requirement for large training datasets had not gone away. NETtalk, an artificial neural network demoed in 1986 which could read written text aloud, required training data which reportedly took 250 hours of human labor to meticulously prepare.

Once again, however, this problem was not unique to artificial neural networks.

Amazon had also noticed that some data processing tasks were simply not practically feasible with computers and were cheaper if performed manually by real people. In 2005, they publicly released Amazon Mechanical Turk, a service which allowed simple “microtasks” like data classification to be crowdsourced to real humans around the world. Amazon’s CEO Jeff Bezos deemed this “artificial artificial intelligence.”

Beginning in 2007, Fei-Fei Li, a researcher at Princeton interested in computer vision, used Amazon Mechanical Turk to convert a starting collection of 160 million raw images into a final data set of 14 million labeled images known as ImageNet. If each image took only 2 seconds to review, this represents more than 10 years of continuous human labor.

Fei-Fei wanted to democratize the ImageNet dataset, so in 2010 she helped set up the ImageNet Large Scale Visual Recognition Challenge. The competition was open to the public and provided teams with a subset of the ImageNet data containing 1.2 million categorized images. Teams used that training set to build object recognition software and their submissions were then tested against the rest of the ImageNet data.

In the 2010 competition, the winning team successfully categorized 72% of the images it was tested on.

In 2011, the winning team reached 74% successful categorization.

In 2012, an artificial neural network entered the competition.

AlexNet, developed by Alex Krizhevsky at the University of Toronto, was an artificial neural network running on general purpose GPUs and trained using backpropagation. AlexNet blew the competition out of the water, achieving an 85% success rate on ImageNet’s challenge while the runner up had done worse than the previous year’s winner.

This was a massive public victory for artificial neural networks and, basically overnight, artificial neural network research spread from a small cohort of underfunded academics into the money-backed world of massive tech corporations.

## The Attention Mechanism

When corporations started working with artificial neural networks, the research naturally shifted in scope. Instead of being driven largely by a desire to understand our own minds, research was now aimed squarely at developing profitable products.

One topic that got a lot of research and development money was language translation.

Software translation programs that existed at the time were rather crude and somewhat limited in use. If you could reliably translate between two languages in a way that correctly understood all the nuances of a language like grammar and figures of speech, that would have immediate and massive commercial value.

Of course, it wasn’t that simple.

An artificial neural network is, at the end of the day, a simple function: something goes in and something comes out. And the things that go in and out have to be strictly defined.

The Perceptron’s input was technically a series of light sensors detecting if a particular spot on the flashcard was black or white. Its output was a voltage that was either positive or negative.

AlexNet’s input was the numerical color value of a fixed number of pixels. Its output was 1000 probability values, one for each of the possible labels that the contest had defined as options.

As you expand the possibilities for your inputs and outputs, the model gets harder and harder to train. You can’t feed an entire blog post into a neural network all at once. You have to break it up.

Consider an example sentence: The bird that my dog scared off was, at the time, sitting on the bank.

How would you break this sentence up into translatable pieces?

“was… sitting” is technically the verb of the sentence; however a parenthetical has been inserted into the middle of it. Additionally, it would translate differently in Spanish, for example, depending on if the subject is masculine or feminine, so to translate it we also need to know that it is a bird which was sitting.

You pretty quickly end up including the whole sentence.

And it gets worse.

What about the word “bank”? Is it a river bank? A power bank? An angled street? A financial institution? In most languages, all these concepts don’t share a single word. Perhaps you can make a fairly confident guess at which one to use. Or perhaps if we had a few more of the surrounding sentences, we could be sure.

In order to keep the inputs and outputs to a trainable size, the translation networks needed a way to be aware of things they weren’t actively processing.

Initial attempts to solve the problem focused on building a memory mechanism into the networks. As the networks processed text, they also kept a working model of the broader context which the network could reference.

This didn’t really scale. Translations need to be precise, and the memory mechanism was, conceptually, a summary. As the text which needed summarizing got bigger, precision was lost. So while memory mechanisms resulted in noticeable improvements, they also had a practical ceiling.

In 2014, Dzmitry Bahdanau revealed his design for an attention mechanism. [As he later explained it](https://x.com/karpathy/status/1864023344435380613):

> \[Attention\] was sort of inspired by translation exercises that learning English in my middle school involved. Your gaze shifts back and forth between source and target sequence as you translate.

Attention allowed each word, as it was translated, to look back over the rest of the document and find other words which might influence the translation. Importantly, it was also trainable with backpropagation, allowing it to learn for itself how to recognize what other words were important. This allowed the meaning of “bank” to be influenced by the presence of the word “river” somewhere earlier in the passage and it allowed “sitting” to be influenced by “was” and “bird” while ignoring “at the time” and “dog.”

Most importantly, however, by keeping all of the original text referenceable instead of summarizing, it could remain precise while translating long passages.

Originally, Bahdanau introduced the attention mechanism as an addition to the models that were already working, bolting it on top of memory mechanisms; however, in 2017 researchers at Google released a paper titled “Attention Is All You Need” which argued that the attention mechanism was more powerful if used by itself.

The argument was in part tied back to GPU processing.

Memory mechanisms require you to read each input word sequentially: you have to read a word and update the memory before you can read the next word, which then references that memory. The attention mechanism design didn’t have this problem: it referenced other words in the original source directly, and since all the words were available from the beginning, this meant you could process all of the input words simultaneously. Ditching memory mechanisms thus allowed translation networks to once again get a performance boost from general purpose GPU computing, which is designed for parallel computation.

This design immediately proved valuable for all sorts of other tasks, and the architecture that Google laid out, known as “the transformer,” is the architecture used in nearly all of the modern AI products we use today.

## Training, Training, and More Training

In 2022, OpenAI released the first public version of ChatGPT, a chatbot powered by the transformer architecture. Initially, its value was somewhat dubious. It could respond to any prompt with well formatted, grammatically correct responses, but the actual content and meaning of those responses was often unreliable or even nonsensical.

Critics were quick to point to these shortcomings as proof that the technology did not have the widespread practical applications companies were claiming it would. This time, the critics were largely ignored.

Over time, new technical tricks were introduced. Chatbots were allowed to look things up on the internet. They were allowed to pass tasks off to more traditional software when appropriate. Some chatbots even generate hidden outputs, allowing them to talk to themselves as they reason through complex problems before generating the final user-facing answer.

However, surprisingly to some, many of the issues were eventually overcome by simply training the networks more.

One way to think about this is that language rules might have come first, but once you know a language you can learn a wide range of other skills. Another way to frame it is that tricks like logical reasoning and math are really just advanced forms of grammar, and knowing facts is not much different than knowing the definitions of words.

The truth is, we don’t really understand enough about how these systems work to say for sure what is happening. Knowing how something is built is still not the same as understanding how it works. What does seem clear is that progress often hinges on having enough training data.

And so, artificial artificial intelligence has become even more ubiquitous.

Every time you do a little puzzle or “identify the bikes” to prove you are not a robot, you are creating training data.

Every time the TSA takes a picture of you and your passport, you are creating training data.

Every time you correct a word your phone tries to autocomplete, you are creating training data.

Even walking down a public city street, increasingly, is likely to be captured on video and used to create training data.

Since system design was somewhat standardized by the transformer architecture, the battle for the most profitable AI products is increasingly a matter of who can gather the best training data. The work of creating that data continues to be outsourced to the rest of us: the artificial artificial intelligences.
