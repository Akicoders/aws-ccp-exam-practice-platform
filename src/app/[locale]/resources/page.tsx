"use client";

import { use } from "react";
import { useMessages } from "../locale-layout-client";

interface ResourceLink {
  labelKey: string;
  url: string;
}

interface Category {
  titleKey: string;
  links: ResourceLink[];
}

const categories: Category[] = [
  {
    titleKey: "official",
    links: [
      { labelKey: "examGuide", url: "https://aws.amazon.com/certification/certified-cloud-practitioner/" },
      { labelKey: "sampleQuestions", url: "https://d1.awsstatic.com/training-and-certification/docs-cloud-practitioner/AWS-Certified-Cloud-Practitioner_Sample-Questions.pdf" },
      { labelKey: "faq", url: "https://aws.amazon.com/certification/faq/" },
    ],
  },
  {
    titleKey: "practice",
    links: [
      { labelKey: "freeDigital", url: "https://explore.skillbuilder.aws/learn/course/external/view/elearning/134/aws-cloud-practitioner-essentials" },
      { labelKey: "examPrep", url: "https://aws.amazon.com/training/learn-about/exam-preparation/" },
    ],
  },
  {
    titleKey: "documentation",
    links: [
      { labelKey: "awsDocs", url: "https://docs.aws.amazon.com/" },
      { labelKey: "iamDocs", url: "https://docs.aws.amazon.com/IAM/latest/UserGuide/" },
      { labelKey: "s3Docs", url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/" },
      { labelKey: "ec2Docs", url: "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/" },
      { labelKey: "lambdaDocs", url: "https://docs.aws.amazon.com/lambda/latest/dg/" },
      { labelKey: "rdsDocs", url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/" },
    ],
  },
  {
    titleKey: "training",
    links: [
      { labelKey: "officialCourse", url: "https://aws.amazon.com/training/learn-about/cloud-practitioner/" },
      { labelKey: "awsRampUp", url: "https://d1.awsstatic.com/training-and-certification/ramp-up_guides/Ramp-Up_Guide_CloudPractitioner.pdf" },
    ],
  },
  {
    titleKey: "whitepapers",
    links: [
      { labelKey: "overview", url: "https://docs.aws.amazon.com/whitepapers/latest/aws-overview/introduction.html" },
      { labelKey: "wellArchitectedWP", url: "https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html" },
      { labelKey: "practitionerGuide", url: "https://aws.amazon.com/certification/certified-cloud-practitioner/" },
    ],
  },
  {
    titleKey: "community",
    links: [
      { labelKey: "awsBlogs", url: "https://aws.amazon.com/blogs/architecture/" },
      { labelKey: "rePost", url: "https://repost.aws/" },
      { labelKey: "youtube", url: "https://www.youtube.com/user/AmazonWebServices" },
    ],
  },
];

export default function ResourcesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const msg = useMessages(locale);

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">{msg.resources.title}</h1>
        <p className="text-text-secondary dark:text-text-dark-secondary text-sm">
          {msg.resources.subtitle}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {categories.map((cat) => {
          const title = (msg.resources.categories as Record<string, string>)[cat.titleKey];
          return (
            <div
              key={cat.titleKey}
              className="rounded-xl border border-border dark:border-border-dark p-4"
            >
              <h2 className="font-semibold mb-3">{title}</h2>
              <ul className="space-y-2">
                {cat.links.map((link) => {
                  const label = (msg.resources.links as Record<string, string>)[link.labelKey];
                  return (
                    <li key={link.labelKey}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-brand-600 dark:text-brand-400 hover:underline"
                      >
                        {label} ↗
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
