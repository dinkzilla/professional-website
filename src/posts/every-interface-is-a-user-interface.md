---
title: "Every Interface is a User Interface"
date: 2024-12-04
description: "Good architecture and good interface design are functionally synonymous."
medium: 3b728cde5fc6
---

In my opinion, the most important skill of any developer is their ability to design good interfaces.

It’s obvious to everyone that the end user interface is important and it’s design should be considerately planned and designed. Generally, developers tend to think the same way about their public APIs. But writing maintainable code relies on treating ***every*** function interface this way.

The main purpose of breaking code into functions is to make the code easier for humans to navigate, use (*hint hint*), and maintain. Your fellow developers are the ***users*** of your code, and they deserve the same level of consideration that the users of your frontend do.

Every time you decide to create a new function, you should ask yourself: Will it be clear to other developers from this function’s ***interface alone*** what it does and how to use it? If the answer is ever no (or any of the soft no traps like “kind of”, “yes if…”, or “yes but…”), then either you didn’t design a good interface or you’ve chosen an inappropriate subset of the code to break off into its own function. If the next developer needs to look at the code within the function for any reason to use or understand it, you’ve failed.

In fact, I’d go as far as to say that good architecture and good interface design are, to some degree, functionally synonymous.

This is generally pretty obvious to Senior developers. Unfortunately, in my experience it is rarely stressed explicitly when training Junior developers. Instead, we naturally tend to focus on more technical minutia of development and engineering. These things change as we change projects, languages, and technologies, but the need for good interface design is the bedrock of good development, regardless of the tech stack.

The natural implication of this is that function interfaces are also the most important part of any code review. The first step of any code review I am doing is to read just the new function interfaces. On startup teams strapped for time and Junior heavy, that is unfortunately sometimes all I have time for.

Consider two extreme alternatives:

1. Easy to understand interfaces with hard to read function code
2. Hard to understand interfaces with easy to read function code

In the first codebase, you can use functions confidently and easily and the bad code is only a nuisance in the functions you are changing. However, even then, the good interfaces mean that you already know what each function is supposed to do and how it is supposed to work, which helps you to decipher the poorly written code.

In the second codebase, you need to read every function in order to use it. Even figuring out which function you are supposed to be using means you are probably reading the code of multiple functions. Your code may be the cleanest, easiest to read code in the world, but if I’m not sure where to find it or how to use it when I need it, who cares?

The next obvious question is “how do I get better at interface design?” That’s beyond the scope of what I can cover in a quick blog entry, and unfortunately, not many resources focus explicitly on this topic. If you want a deeper dive, I would point you to [A Philosophy of Software Design by John Ousterhout](https://www.amazon.com/Philosophy-Software-Design-John-Ousterhout/dp/1732102201). It’s not explicitly about interface design, but it does a great job at teaching it. It is the first (and honestly only) book I would recommend to Junior developers, and I think developers of any level will benefit from reading it.
