---
title: "React just isn’t designed for startups"
date: 2024-12-11
description: "What does your business need from a web framework?"
medium: d0d9f218c5ad
---

The framework you pick for your application has a huge impact on your team and implications that will be with your business for years, if not forever. It’s likely one of the most important architectural decisions you will make.

I’ve worked with a lot of startups, and most have chosen React. Of those companies, not a single one did it well.

This isn’t just anecdotal. If you think about what React was designed to do, it becomes pretty obvious pretty quickly that it’s at odds with how a startup needs to operate.

## **What does a startup need from a frontend framework?**

Let’s put the horse in front of the cart and lay out some assumptions about the needs of a startup. Most commonly, a startup, as I’d define it, is working under the following constraints at the start of their journey:

1. Very small team
2. Very tight budget
3. Need to move as fast as possible

Let’s translate that into technical requirements.

If you have any level of success at all, a small team means you’ll need to grow. When you look to hire, you’ll ideally want people who know your chosen framework already, so you should pick something fairly well known and well established. Avoid obscure or up-and-coming solutions.

Unfortunately, your budget is tight, so you can’t afford the best talent and you’ll likely end up more Junior heavy than you’d like in your early stages or have a high level of turnover (probably both). So you need a framework that is as easy as possible to learn, preferably with clearly documented solutions to many complex problems.

To move fast, it’s also an advantage if the way people build apps in the framework is standardized. This reduces further architectural decisions you have to make later, and it will help onboard even Senior developers more rapidly. This also reinforces the last point — if the implementation is standardized, this means solutions to problems found online will be easier to adapt to your own use cases.

So to summarize, our list of criteria then is:

1. Well established
2. Easy to learn / use
3. Good documentation of complex solutions available
4. Standardized implementation

Now let’s have a look at how React stacks up…

## What was React built for?

As Facebook’s Ads platform got more and more complicated, it got harder and harder to maintain and less and less performant. The web development tools at the time were not built to support such large teams or such complicated, computationally intensive applications. So they built their own. In 2011 it was open-sourced to the wider public.

There are a lot of technical details about React and they made a lot of design decisions, but at the highest level, it can be understood as trying to solve two problems:

1. Keeping code maintainable in large teams
2. Keeping one of the most complicated applications on the internet performant on 2011 consumer hardware (i.e. early smartphones).

You can probably already see the issue: these are not the concerns of a modern startup.

React was designed for very large teams, and a startup has very small teams. And while performance is always a concern, your startup does not have one of the most complex applications on the internet, and likely never will. Even if it eventually might be, that is several complete application rewrites away. Additionally, consumer hardware has come a long way since 2011, as have browsers and web frameworks.

## But what’s the harm?

Just because it wasn’t designed for you doesn’t mean it won’t work for you. After all, React is definitely well established, which was our first criteria.

But React had to make some tradeoffs to achieve its goals, so let’s look at what they mean in relation to a startup.

### Not a framework

React doesn’t call itself a “framework,” it is a “library for user interfaces.” By itself, React doesn’t give you everything you’ll need to build an application. It is only meant to handle the UI rendering.

This means if you use React, there are a whole host of other immediate architectural decisions that need to be made. We need to move fast and said we wanted minimal further architectural decisions, so this is a negative.

Once these decisions are made, we will end up with a somewhat custom web architecture. All the new employees we said we were planning for need to be taught the details of those choices and how we implemented them, which slows us down again and violates our “standardized implementation” criteria.

Additionally, because everyone has to build their own custom implementation, the documentation and questions online can be all over the place and take an extra level of translation to apply to any given React project. This violates another of our selection criteria: “Good documentation for complex solutions.”

### New architectures and best practices

When React was originally released, its designers had to spend a lot of time defending it publicly. It violated a lot of best practices that existed at the time. They argued (very legitimately and successfully) that at certain scales new best practices were needed.

But these best practice changes only made sense for frontends (and only in certain cases). The previous class of frontend framework essentially attempted to mimic the architecture of backend frameworks. This makes them easier to learn if you’re already familiar with (or also learning) backend architecture. This is still true today, since backend architectural patterns and best practices remain largely unchanged.

For Facebook, this wasn’t a big deal, since they’re a huge company with dedicated frontend developers who didn’t need to worry about backend patterns. But we said our team was small, so every developer is probably working throughout our entire stack, and we wanted a framework that is easy to learn, so React isn’t the ideal choice.

## Aren’t you oversimplifying?

Yes, absolutely. This is a blog not a book. I’ve purposefully avoided getting into the technical details. I’m sure the React defenders out there are seething over some of what I’ve said here.

My goal is not to convince you that React is awful and impossible to maintain. It’s definitely not. For some teams, it is the best choice. For Facebook and other big teams with massively complex applications, it is unquestionably a huge advancement for the profession.

What I’m advocating for is that you consider if you actually have the problems that it is meant to solve. “It’s the most popular, so we’re going to use it” is itself an oversimplification, and a potentially dangerous one.

In my opinion, choosing React is almost always a mistake for startups and small teams. This isn’t because React is bad. It’s because it’s not the appropriate tool for the job. If startups actually consider what makes sense for their business, most will likely conclude that what they actually want is a fully featured, opinionated web framework with the simplest possible API. That is not React.

## An analogy for the road

The Ford F-Series is the most popular car in America. They’re fantastic vehicles if you need a truck. But if you live in a city where you need to parallel park and the main cargo you transport is groceries, it’d be a bad choice for you. That doesn’t mean you can’t make it work, but there will be days where you’re going to struggle to find parking, loading and unloading your groceries is going to be more annoying, and you’ll end up spending way more on gas than you needed to.
