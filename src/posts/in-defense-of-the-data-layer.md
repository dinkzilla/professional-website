---
title: "In Defense of the Data Layer"
date: 2024-10-10
description: "It has nothing to do with replacing your database."
medium: 977c223ef3c8
---

I’ve noticed a growing trend in online application architecture discussions of disparaging designs which include data layer abstraction. The general argument usually goes: “Data layer abstraction is great if you have to swap out your database, but that’s pretty uncommon and the overhead isn’t worth it for such an unlikely hypothetical.”

I have a couple problems with this reasoning.

First off, there is the idea that database redesigns and swaps are uncommon. My suspicion is that this misconception comes from the fact that most developers work on teams with established apps at companies with established businesses — the proper technology, tools, and infrastructure have already been worked out. However, if you think for a second about when such a swap would occur, it is when your application or your business is new and growing and still finding it’s usage patterns and market fit. Or when you’re moving so fast on such a low budget that you don’t have time to fully vet every piece of technology or think through every data design implication because your business isn’t even profitable yet. Most developers don’t experience data layer changes very often (if ever) in their careers, and so they don’t realize how common they actually are **during the stage of development where you are actually making the decision to include a data layer or not.**

I could write a whole blog post laying out why data layer refactors are in fact very common, especially at startups. And yes, it cannot be overstated how much easier a data layer abstraction makes those efforts. However, the loud people of the internet are actually kind of right here despite themselves — this is not, on it’s own, a very compelling reason to design a data layer into your application. **Easier data layer refactors are a benefit but not a justification for data layer abstraction.**

## So what is the justification for a data layer?

**Abstracting your data layer is all about reducing cognitive load.** When you are working on business logic, you shouldn’t have to worry about how and where the data is stored, what tools are used to retrieve it, the efficiency of queries, or the infratructure it’s stored on. All of those are considerations which add to your cognitive load, leaving less space in your mind for the problem you are actually supposed to be working on.

Consider the following basic business logic:

> Whenever a new user is created, a new project should also be created with that user as it’s owner.

Here is some over-simplified code:

```
createUser(firstName, lastName, emailAddress, createdByUserId){
    // Create the User
    const user = await prisma.user.create({
      data: {
        first_name: firstName,
        last_name: lastName,
        created_by: createdByUserId
        attributes: {
          create: {
            name: 'email',
            value: emailAddress,
          },
        },
      },
    });

    // Create the new project
    const project = await prisma.project.create({
      data: {
        name: `${firstName} ${lastName}'s First Project`,
        owner: {
          connect: { id: user.id }
        }
      },
    });

    // Link the user to the project via UserProjects
    await prisma.userProjects.create({
      data: {
        userId: user.id,
        projectId: project.id,
      },
    });

    // Send welcome email
    await this.emailService.sendWelcomeEmail(
      user.attributes.find(
        attribute => {
           return attribute.name === 'email';
        }
      );
    );

    // Map prisma user object into a domain User object for return...
}

```

(If you don’t know Prisma’s syntax, don’t worry. That’s part of the point.)

Note what you need to understand and keep in mind any time you work on this function:

- The names of the tables and their columns.
- Prisma is the ORM in use, so you need to understand it’s behavior and syntax and it had to be initialized in or injected into the class constructor (not shown).
- A linking table (UserProjects) is used to connect Users to Projects for project membership
- The Project owner is linked via the Projects table directly.
- Email is stored in a different table than the User’s names.
- The object types used are based on the database table structure and dictated by Prisma, not defined based on the business domain’s conception of the objects. You need to understand both.

The same code with a data layer implemented requires none of the above knowledge:

```
createUser(firstName, lastName, emailAddress) {
  // Create user
  const user = await this.dataLayer.createUser(
    firstName,  
    lastName, 
    emailAddress
  );

  // Create a first project with the user as an admin
  const project = await this.dataLayer.createProject(
    `${user.firstName} ${user.lastName}'s First Project`, 
    user.id, //adminId
  );

  // Send welcome email
  this.emailService.sendWelcomeEmail(user.email);
}
```

A User is created. AProject is created, named with a certain format, and with the new User as the owner. An email is sent. This code is significantly easier to read and understand because it is just the business logic and thus requires significantly less cognitive load.

Granted, when originally setting up this function, building out the data layer may take more work overall if this is the first time “create user” and “create project” have been needed at that layer. That code still needs to exist. This design also results in multiple files and functions instead of one and more code overall. **But we shouldn’t be designing code based on the efficiency of the initial writing of it — that isn’t design at all, it’s just hacking.** **We should be designing code for long term readability and maintainability.** That’s how we avoid future bugs and how we set ourselves up for easier and faster development down the line.

As a reinforcing example, let’s pretend two years have passed and you get the following ticket:

> When a new user is created, the new project that is created should have the user who created them as an admin instead of the created user themselves.

You have a junior developer who just joined your team. They have probably never encountered a linking table before. They’ve definitely never used Prisma. They’re new to all of your business concepts and terminology. If you wanted to give them this ticket, which codebase do you think they’d be more quickly and competently successful in?

Now consider the same question for a senior developer who is new to your organization and has never used Prisma.

Now consider doing the ticket yourself.

## What’s causing the Anti-Data Layer trend?

I actually have a theory on why this is happening as well, although it’s just a guess.

When defenders of data layer abstraction explain it to new developers, they often use replacing the database as the example because it’s the easiest example to conceptualize and is extremely effective at making the division of the two layers clear. This was definitely the example used to explain it to me. But as those developers grow up into architects themselves, if that’s the only reason they remember for why their predecessors did things that way, I think it makes perfect sense to throw that idea out — especially if they have worked on few if any from-scratch projects and never been on a data layer swap initiative.

When mentoring, we need to do a better job of explaining higher level architectural reasoning instead of simply providing quick conceptual examples to tactically explain what code a junior developer should put in what place. Eventually, juniors become seniors and seniors become architects. **Helping build a strong foundation early takes more time, but it is just as important for people as it is for a codebase, if not more so.**
