---
title: "Why are Microservices?"
date: 2023-07-07
description: "We all cringe when a client, product owner, executive, or other layperson tries to use the latest technology buzzwords. But let’s be honest: as an industry, we’re also really bad…"
medium: 43eb102fac22
---

We all cringe when a client, product owner, executive, or other layperson tries to use the latest technology buzzwords. But let’s be honest: as an industry, we’re also really bad about consistently using buzzwords and terminology, even amongst ourselves. This makes getting up to speed for new developers harder, but it also makes communication between experienced colleagues unnecessarily difficult.

In my experience, nowhere is this more stark than in the industry’s use of the term “microservice.” It is often used vaguely without definition, and the use within a single team or a single blog post is often contradictory. So, let’s take a minute and clarify some definitions, which will hopefully improve both our communication and our architectural choices.

## What Microservices are Not

Let’s begin by examining the ways in which the term “microservice” is most commonly misused.

Many developers use the term interchangeably with the term “distributed”, or (worse) “serverless”, or (worst) “Lambda.”

This is somewhat understandable. Microservice Architecture is a type of Distributed Architecture; Distributed Architectures are very often Serverless Architectures; and one of the most popular serverless offerings is AWS Lambda. However, while these terms are related in a number of ways and will often look similar if not directly overlap, they are all distinct concepts, and we should be intentional as we use them if we want to communicate effectively about our design choices.

In my opinion, the distinction between them becomes significantly more clear when you consider the problem each intends to solve. So let’s look at ***why*** you might use each pattern, which will help us understand where they differ.

### Why is Serverless Architecture?

*Serverless Architecture is intended to reduce the overhead of deploying and managing your infrastructure.*

Managing infrastructure is a pain. Sizing, acquisition, scaling, configuration, patching, networking, load balancing, redundancy, resilience, security — these are problems every application faces, so why do you have to solve them over and over again for every new task? Wouldn’t it be nice if you didn’t have to think about the infrastructure your code ran on and could focus more on the actual business logic you needed to write?

“Serverless” refers to a class of service offerings which abstract away all those annoying parts of physical infrastructure. A serverless database, for example, can provide you with a database in a few clicks of a button or lines of code. The database is already online, will grow in storage size and compute power automatically as needed, and is deployed in a redundant way with failover policies configured out of the box. You need a place to put your data, and serverless databases provide that in the easiest way possible so you can get on to designing your data model.

Because serverless service providers get to benefit from economies of scale and because they are typically priced based on usage, Serverless Architectures (architectures built on top of these serverless services) are typically cheaper to run as well, even without having to factor in the manpower you’re saving in setup, support, and maintenance.

### Why is Distributed Architecture?

*Distributed Architectures are designed to use infrastructure resources more efficiently.*

The central conceit of this pattern is that different parts of a system have different infrastructure needs.

Imagine a simple forum where users can post text or pictures. Text posts are simple — the traffic patterns are predictable throughout the day and the memory and processing power needed are pretty minimal since they are simply saved directly into the database. Image uploads on the other hand are more complicated — certain topics, arising randomly throughout the day, lead to sudden unpredictable spikes in image uploads, and they also require a great deal of processing power and memory as you compress the image for storage and generate thumbnails for image previews at different sizes.

If your infrastructure options are costly and time consuming to set up and maintain, you’re likely to architect a solution in which the entire system shares all of its resources. This will result in infrastructure which is very inefficient from a cost perspective, as every configuration must take into account the highest required value among all parts of the system. Memory and processing must be high, to handle the image uploads, but the infrastructure must also be scaled to handle consistently high levels of traffic, to handle the text posts. This can lead to extremely inefficient use of infrastructure resources, especially as you scale.

However, with serverless services making it easier and cheaper to spin up new infrastructure, it has become easier to break the system apart and run different pieces of code on infrastructure specifically tuned to their needs. This is Distributed Architecture. It can give you performance and scaling in a much more cost effective way and, as an added benefit, this comes with improved fault tolerance, since a crash in a single part of your system will not necessarily bring your entire system down.

## Why is Microservice Architecture?

*Microservice Architecture is a pattern intended to help you scale your* ***human*** *development organization.*

Microservice Architecture is a very specific type of Distributed Architecture. Although you will often get many of the benefits of more general Distributed Architecture in the process, the focus is not on infrastructure needs, but human delivery process needs.

Imagine you’re at a startup that just secured a new round of funding, and the investors are expecting you to use that to drastically scale up your new feature development efforts. So far, you’ve had a single team of four developers working on your application. Now, you have the budget to hire 12 more. Obviously, you can no longer function as a single team, but how will you divide the work?

A common initial impulse is to divide your application stack horizontally — you set up a front-end team, a back-end team, and a data layer team. The problem with this approach is that when a feature request comes in, it needs work from all three teams. While this team structure has allowed your teammates to specialize, it requires an extremely high level of coordination between the teams which are effectively working as sub-units of a single, large delivery team. You might be able to make this work for a while, but it will become untenable as the size of your development organization continues to grow.

If you want your teams to be able to deliver features independently, you instead need to divide your stack vertically. As an example, you might have a team for user management, another for forum posting, a third for image processing, and a final team for reporting.

For this model to scale as you continue to grow, you need these teams to be able to work as independently as possible. From an architecture perspective, this means that the parts of the system that each team is responsible for, the “microservices”, also need to be as independent as possible.

To accomplish this, each microservice should:

- Run on their own independent infrastructure
- Communicate with other microservices only through strictly defined network-based interfaces
- Maintain their own data

When a Microservice Architecture is built correctly, teams only need to interact with each other when their exposed interfaces change. If you properly implement versioning on these interfaces, these changes become non-blocking to other teams and these interactions can become asynchronous. Isolating the microservices on their own infrastructure and requiring them to manage their own independent data guarantees no unforeseen coupling occurs between the microservices and facilitates independent release pipelines for your teams.

## So What Architecture is Right for Me?

These are not mutually exclusive patterns and often are deployed together. Considering carefully the specific problems facing your organization and knowing what problems each pattern is meant to solve should guide you towards solid architectural choices.

Serverless Architecture will benefit almost all organizations. There are very few valid reasons to avoid serverless technologies today, since it is typically both easier and cheaper than the alternative. Infrastructure management and scaling is likely not part of your business’s value proposition, so don’t take it on if it can be avoided.

Distributed Architectures can be beneficial for scaling, performance, resilience, and cost, but most of these benefits come at high traffic scales. At the same time, Distributed Architectures add management overhead, are more difficult to conceptualize and work in, and take more significant planning. As a result, they are probably not ideal for small companies and startups unless your team has significant experience working in a Distributed Architecture already.

Microservice Architectures are a specialized kind of Distributed Architecture, and thus incur even more overhead, especially with the requirement that each microservice manage its own data. This pattern is a tool specifically for growing teams and should be considered at the point where your development team growth begins to drag on your delivery timelines. Adopting these patterns too early can put a fatal tax on new feature delivery, so timing the adoption of Microservice Architecture should be planned with care.
